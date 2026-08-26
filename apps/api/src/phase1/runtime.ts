import { tutorMoveSchema, type TutorInputEvent, type VisualContent } from '@aria/shared';
import type { LoadedTurnContext, PlannedTurn } from '@aria/tutor';

import { createIntentClassifier } from '@/ai/intent/model-intent.classifier';
import { createModelPlanner } from '@/ai/planner/model-planner';
import { plannerBudgetMs } from '@/ai/planner/planner.budget';
import { createInventoryService, type InventoryService } from '@/curriculum';
import { buildVisual, firstVisualFor } from '@/curriculum/visuals/show-payloads';
import { ForbiddenError } from '@/errors';
import { createTurnContentObserver } from '@/observability/content-metrics';
import { createIntentFallbackObserver } from '@/observability/intent-metrics';
import type { ArithmeticProblem } from '@/quality/arithmetic';
import type { RouterDeps } from '@/routes';
import { createWebhookEscalationPort } from '@/safety/crisis/escalation.runtime';
import {
  createTurnContentService,
  type ApiModelContext,
  type TurnContentService,
} from '@/services/content/turn-content.service';
import type { StreamingDeps } from '@/services/content/turn-content.types';
import { createMemoryRetrievalService } from '@/services/memory/retrieve.service';
import { createMoveFactory } from '@/services/moves/move-factory';
import { createTurnCommitService } from '@/services/tutor/commit.service';
import { createTutorContextLoader } from '@/services/tutor/context.loader';
import { createCrisisTurnService } from '@/services/tutor/crisis-turn.service';
import { createPlannerObserver } from '@/services/tutor/planner-evidence';
import { createTutorService } from '@/services/tutor/tutor.service';

import { buildContentServices, type ContentServices } from './content.runtime';
import { buildPhase1Controllers } from './controllers.runtime';
import { buildRepositories } from './repositories.runtime';

import type { Phase1Repositories, Phase1RuntimeDeps } from './runtime.types';

export async function createPhase1Runtime(deps: Phase1RuntimeDeps): Promise<
  Readonly<{
    student: NonNullable<RouterDeps['student']>;
    turn: ReturnType<typeof buildPhase1Controllers>['turn'];
    repositories: Phase1Repositories;
  }>
> {
  const repositories = buildRepositories(deps);
  const inventory = createInventoryService();
  await seedInventory(repositories, inventory);
  const content = buildContentServices(deps, repositories, inventory);
  const tutor = buildTutor(deps, repositories, inventory, content);
  const crisis = buildCrisis(deps, repositories, content);
  const controllers = buildPhase1Controllers({
    deps,
    repositories,
    tutor,
    crisis,
    gate: content.gate,
    cancelAhead: (sessionId) => {
      content.ahead.cancel(sessionId);
    },
  });
  return { ...controllers, repositories };
}

async function seedInventory(
  repositories: Phase1Repositories,
  inventory: InventoryService,
): Promise<void> {
  const misconceptions = inventory
    .listSkills()
    .flatMap((skill) => inventory.listMisconceptions(skill.code));
  await repositories.skills.seed(inventory.listSkills(), misconceptions);
}

function buildTutor(
  deps: Phase1RuntimeDeps,
  repositories: Phase1Repositories,
  inventory: InventoryService,
  content: ContentServices,
) {
  const memory = createMemoryRetrievalService({
    memory: repositories.memory,
    clock: deps.clock,
    maxTokens: 300,
    recordSize: () => {
      /* persisted with the move evidence */
    },
  });
  const context = createTutorContextLoader({
    sessions: repositories.sessions,
    events: repositories.events,
    skills: repositories.skills,
    students: repositories.students,
    retrieve: memory.retrieve,
    misconceptionIds: (skillCode) => inventory.listMisconceptions(skillCode).map((item) => item.id),
    lesson: (skillCode) => inventory.getLesson(skillCode),
  });
  const turnContent = buildTurnContent(deps, inventory, content);
  const commit = createTurnCommitService({
    pool: deps.pool,
    events: repositories.events,
    skills: repositories.skills,
    sessions: repositories.sessions,
    clock: deps.clock,
    outbox: repositories.outbox,
  });
  return createTutorService({
    ports: {
      loadContext: context.load,
      resolveContent: (turn, signal) => resolveContent(content, turnContent, turn, signal),
      commit: commit.commit,
    },
    clock: deps.clock,
    sessionLimitMs: (band) => deps.config.sessionLimitMinutes[band] * 60_000,
    requireOwnership: async (studentId, sessionId) => {
      const session = await repositories.sessions.findById(sessionId);
      if (session?.studentId !== studentId)
        throw new ForbiddenError('student session ownership mismatch');
    },
    latestMoveId: (sessionId) => latestMoveId(repositories, sessionId),
    logger: deps.logger,
    intent: createIntentClassifier({
      ai: deps.ai,
      onFallback: createIntentFallbackObserver({ metrics: deps.metrics }),
    }),
    ...plannerPorts(deps),
  });
}

function buildTurnContent(
  deps: Phase1RuntimeDeps,
  inventory: InventoryService,
  content: ContentServices,
): TurnContentService {
  return createTurnContentService({
    reliable: content.reliable,
    ai: deps.ai,
    gate: content.gate,
    moves: (sessionId) => createMoveFactory({ ids: deps.ids, clock: deps.clock, sessionId }),
    remediation: (id) => inventory.getMisconception(id)?.remediation ?? null,
    visual: (skillCode, problem) => visualFor(inventory, skillCode, problem),
    observer: createTurnContentObserver({ metrics: deps.metrics, logger: deps.logger }),
    ...streamingDeps(deps, content),
  });
}

/** P2H-07: streaming is configured whole or not at all; a half-configured one is off. */
function streamingDeps(
  deps: Phase1RuntimeDeps,
  content: ContentServices,
): Readonly<{ streaming?: StreamingDeps }> {
  const { respond } = content;
  const segments = deps.segments;
  if (respond === undefined || segments === undefined) return {};
  return { streaming: { respond, segments, ids: deps.ids } };
}

/** The planner and everything that keeps it inside its budget and on the record (P2H-06). */
function plannerPorts(deps: Phase1RuntimeDeps) {
  return {
    planner: createModelPlanner({ ai: deps.ai }),
    plannerBudgetMs: (context: LoadedTurnContext<ApiModelContext>, event: TutorInputEvent) =>
      plannerBudgetMs(context.session.band, event),
    observePlan: createPlannerObserver({ metrics: deps.metrics, logger: deps.logger }),
  };
}

/** The id of the last move Aria actually delivered, for the stale-`SILENCE` check (P2H-01). */
async function latestMoveId(
  repositories: Phase1Repositories,
  sessionId: string,
): Promise<string | null> {
  const records = await repositories.events.list(sessionId);
  for (const record of [...records].reverse()) {
    if (record.actor !== 'aria') continue;
    const parsed = tutorMoveSchema.safeParse(record.payload);
    if (parsed.success) return parsed.data.id;
  }
  return null;
}

async function resolveContent(
  content: ContentServices,
  turnContent: TurnContentService,
  turn: PlannedTurn<ApiModelContext>,
  signal?: AbortSignal,
) {
  content.ahead.cancel(turn.context.session.id);
  const resolved = await turnContent.resolve(turn, signal);
  const ask = resolved.moves.find((move) => move.kind === 'ASK');
  if (ask !== undefined && turn.plan.skillCode !== null) {
    const itemId = resolved.privateEvidence.contentItemId;
    content.ahead.schedule(turn.context.session.id, {
      kind: 'question',
      skillCode: turn.plan.skillCode,
      band: turn.context.session.band,
      studentId: turn.context.session.studentId,
      ...(typeof itemId === 'string' ? { excludeIds: [itemId] } : {}),
    });
  }
  return resolved;
}

function buildCrisis(
  deps: Phase1RuntimeDeps,
  repositories: Phase1Repositories,
  content: ContentServices,
) {
  return createCrisisTurnService({
    pool: deps.pool,
    events: repositories.events,
    flags: repositories.flags,
    gate: content.gate,
    escalation: createWebhookEscalationPort({
      url: deps.config.safeguardingWebhookUrl,
      token: deps.config.safeguardingWebhookToken,
      fetcher: globalThis.fetch,
    }),
    moves: (sessionId) => createMoveFactory({ ids: deps.ids, clock: deps.clock, sessionId }),
    clock: deps.clock,
    logger: deps.logger,
  });
}

/**
 * P2H-10: the picture a skill is shown with, captioned from its lesson note.
 *
 * The caption is the note's first concrete model rather than a generic label, so the child
 * hears the same words about the picture that the explanation used about the idea.
 */
function visualFor(
  inventory: InventoryService,
  skillCode: string,
  problem: ArithmeticProblem | null,
): VisualContent | null {
  const skill = inventory.getSkill(skillCode);
  const kind = firstVisualFor(skill);
  if (kind === null) return null;
  const caption = inventory.getLesson(skillCode)?.models[0] ?? skill?.name ?? skillCode;
  return buildVisual({ kind, caption, problem });
}
