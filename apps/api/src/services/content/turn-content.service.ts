import { z } from 'zod';

import type { TutorMove } from '@aria/shared';
import type { PlannedTurn, ResolvedContent } from '@aria/tutor';

import type { AiClient } from '@/ai';
import type { ReliableContentService } from '@/content/content.service';
import {
  NULL_TURN_CONTENT_OBSERVER,
  type TurnContentObserver,
} from '@/observability/content-metrics';
import type { ScrubbedContext } from '@/privacy';
import type { QualityGate } from '@/quality';
import { arithmeticProblemSchema, type ArithmeticProblem } from '@/quality/arithmetic';
import {
  generateGatedText,
  requiredGatedText,
  throwIfAborted,
  type GenerationOutcome,
} from '@/services/content/generate-text';
import { fallbackText } from '@/services/content/turn-fallback';
import { isDetour, responseMove } from '@/services/content/turn-response';
import type { MoveFactory } from '@/services/moves/move-factory';

export type ApiModelContext = Readonly<{
  scrubbed: ScrubbedContext;
  answerKey: string | null;
  latestQuestion: string | null;
  estimatedTokens: number;
  retrievedFactIds: readonly string[];
  recentContentItemIds: readonly string[];
  arithmeticProblem: ArithmeticProblem | null;
  completionOnly: boolean;
  latestAsk: Extract<TutorMove, { kind: 'ASK' }> | null;
}>;

const questionBodySchema = z
  .object({
    prompt: z.string().min(1).max(2_000),
    choices: z.array(z.string().min(1).max(300)).min(2).max(8).optional(),
    answerKey: z.string().min(1).max(500).optional(),
    arithmeticProblem: arithmeticProblemSchema.optional(),
    completionOnly: z.boolean().optional(),
  })
  .loose();

export type TurnContentService = Readonly<{
  resolve(turn: PlannedTurn<ApiModelContext>, signal?: AbortSignal): Promise<ResolvedContent>;
}>;

export function createTurnContentService(deps: {
  reliable: ReliableContentService;
  ai: AiClient | null;
  gate: QualityGate;
  moves(sessionId: string): MoveFactory;
  remediation(misconceptionId: string): string | null;
  observer?: TurnContentObserver;
}): TurnContentService {
  return {
    resolve: (turn: PlannedTurn<ApiModelContext>, signal?: AbortSignal) =>
      resolve(deps, turn, signal),
  };
}

async function resolve(
  deps: Parameters<typeof createTurnContentService>[0],
  turn: PlannedTurn<ApiModelContext>,
  signal?: AbortSignal,
): Promise<ResolvedContent> {
  throwIfAborted(signal);
  if (turn.plan.kind === 'ASK') return resolveQuestion(deps, turn, signal);
  const remediation = currentRemediation(deps, turn);
  if (remediation !== null) {
    const text = requiredGatedText(deps.gate, remediation, turn.context.session.band);
    return responseWithContinuation(
      deps,
      turn,
      { text, provenance: { contentSource: 'reviewed-remediation' } },
      signal,
    );
  }
  const outcome = await generateGatedText(deps, turn, signal);
  throwIfAborted(signal);
  if (outcome.kind === 'generated') {
    return responseWithContinuation(
      deps,
      turn,
      { text: outcome.text, provenance: provenance(outcome) },
      signal,
    );
  }
  (deps.observer ?? NULL_TURN_CONTENT_OBSERVER).fallbackUsed(turn.plan.kind, outcome.reason);
  const text = requiredGatedText(deps.gate, fallbackText(turn), turn.context.session.band);
  return responseWithContinuation(deps, turn, { text, provenance: provenance(outcome) }, signal);
}

/** P2H-02/P2H-03: every turn records where its words came from and which prompt made them. */
function provenance(outcome: GenerationOutcome): Readonly<Record<string, unknown>> {
  return outcome.kind === 'generated'
    ? {
        contentSource: 'model',
        promptName: outcome.promptName,
        promptVersion: outcome.promptVersion,
      }
    : { contentSource: 'fallback', fallbackReason: outcome.reason };
}

function currentRemediation(
  deps: Parameters<typeof createTurnContentService>[0],
  turn: PlannedTurn<ApiModelContext>,
): string | null {
  const id =
    turn.plan.kind === 'RETEACH'
      ? (turn.decision.graded?.misconception ?? turn.context.session.repeatedMisconception)
      : null;
  return id === null ? null : deps.remediation(id);
}

async function resolveQuestion(
  deps: Parameters<typeof createTurnContentService>[0],
  turn: PlannedTurn<ApiModelContext>,
  signal?: AbortSignal,
): Promise<ResolvedContent> {
  throwIfAborted(signal);
  const skillCode = turn.plan.skillCode;
  if (skillCode === null) return resolveOpenQuestion(deps, turn);
  const content = await deps.reliable.resolve(
    {
      kind: 'question',
      skillCode,
      band: turn.context.session.band,
      studentId: turn.context.session.studentId,
      excludeIds: turn.context.modelContext.recentContentItemIds,
    },
    signal,
  );
  throwIfAborted(signal);
  const body = questionBodySchema.parse(content.body);
  const display = questionDisplay(body);
  for (const childText of [body.prompt, ...(body.choices ?? [])]) {
    requiredGatedText(
      deps.gate,
      childText,
      turn.context.session.band,
      content.source === 'generated',
    );
  }
  const move = deps.moves(turn.context.session.id).make({
    kind: 'ASK',
    skillId: skillCode,
    itemId: content.itemId ?? `fallback-${skillCode}`,
    attempt: turn.plan.attempt,
    speech: { text: body.prompt },
    display,
    expects: body.choices === undefined ? 'text' : 'choice',
  });
  return {
    moves: [move],
    privateEvidence: {
      ...contextEvidence(turn),
      answerKey: body.answerKey ?? null,
      arithmeticProblem: body.arithmeticProblem ?? null,
      completionOnly: body.completionOnly ?? false,
      contentSource: content.source,
      approach: turn.plan.approach,
      ...(content.itemId === null ? {} : { contentItemId: content.itemId }),
    },
  };
}

function resolveOpenQuestion(
  deps: Parameters<typeof createTurnContentService>[0],
  turn: PlannedTurn<ApiModelContext>,
): ResolvedContent {
  const text = requiredGatedText(deps.gate, 'What do you think?', turn.context.session.band);
  return {
    moves: [responseMove(deps.moves(turn.context.session.id), turn, text)],
    privateEvidence: contextEvidence(turn),
  };
}

function questionDisplay(body: z.infer<typeof questionBodySchema>): TutorMove['display'] {
  return body.choices === undefined
    ? [{ type: 'text', body: body.prompt, markdown: false }]
    : [
        {
          type: 'choices',
          options: body.choices.map((choice) => ({ id: choice, label: choice })),
        },
      ];
}

function contextEvidence(turn: PlannedTurn<ApiModelContext>): Readonly<Record<string, unknown>> {
  return {
    contextTokens: turn.context.modelContext.estimatedTokens,
    retrievedFactIds: turn.context.modelContext.retrievedFactIds,
  };
}

async function responseWithContinuation(
  deps: Parameters<typeof createTurnContentService>[0],
  turn: PlannedTurn<ApiModelContext>,
  said: Readonly<{ text: string; provenance: Readonly<Record<string, unknown>> }>,
  signal?: AbortSignal,
): Promise<ResolvedContent> {
  const feedback = responseMove(deps.moves(turn.context.session.id), turn, said.text);
  const evidence = { ...contextEvidence(turn), ...said.provenance };
  const detour = isDetour(turn);
  if (turn.plan.kind === 'HINT' || turn.plan.kind === 'RETEACH' || detour) {
    const prior = turn.context.modelContext.latestAsk;
    return {
      moves: prior === null ? [feedback] : [feedback, retryAsk(deps, turn, prior, !detour)],
      privateEvidence: evidence,
    };
  }
  if (!['PRAISE', 'REVEAL', 'SWITCH'].includes(turn.plan.kind)) {
    return { moves: [feedback], privateEvidence: evidence };
  }
  const next = await resolveQuestion(
    deps,
    { ...turn, plan: { ...turn.plan, kind: 'ASK', attempt: 1 } },
    signal,
  );
  return {
    moves: [feedback, ...next.moves],
    privateEvidence: { ...evidence, ...next.privateEvidence },
  };
}

function retryAsk(
  deps: Parameters<typeof createTurnContentService>[0],
  turn: PlannedTurn<ApiModelContext>,
  prior: Extract<TutorMove, { kind: 'ASK' }>,
  countAttempt: boolean,
): TutorMove {
  return deps.moves(turn.context.session.id).make({
    kind: 'ASK',
    skillId: prior.skillId,
    itemId: prior.itemId,
    attempt: countAttempt ? Math.min(10, prior.attempt + 1) : prior.attempt,
    vocabularyHint: prior.vocabularyHint,
    speech: prior.speech,
    display: prior.display,
    expects: prior.expects,
  });
}
