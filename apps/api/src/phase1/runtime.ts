import type { PlannedTurn } from '@aria/tutor';

import { createInventoryService, type InventoryService } from '@/curriculum';
import { ForbiddenError } from '@/errors';
import type { RouterDeps } from '@/routes';
import { createWebhookEscalationPort } from '@/safety/crisis/escalation.runtime';
import {
  createTurnContentService,
  type ApiModelContext,
  type TurnContentService,
} from '@/services/content/turn-content.service';
import { createMemoryRetrievalService } from '@/services/memory/retrieve.service';
import { createMoveFactory } from '@/services/moves/move-factory';
import { createTurnCommitService } from '@/services/tutor/commit.service';
import { createTutorContextLoader } from '@/services/tutor/context.loader';
import { createCrisisTurnService } from '@/services/tutor/crisis-turn.service';
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
  });
  const turnContent = createTurnContentService({
    reliable: content.reliable,
    ai: deps.ai,
    gate: content.gate,
    moves: (sessionId) => createMoveFactory({ ids: deps.ids, clock: deps.clock, sessionId }),
    remediation: (id) => inventory.getMisconception(id)?.remediation ?? null,
  });
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
  });
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
