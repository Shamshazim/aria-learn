import type { PlannedTurn, ResolvedContent } from '@aria/tutor';

import { NULL_TURN_CONTENT_OBSERVER } from '@/observability/content-metrics';
import { fixedText } from '@/services/content/fixed-text';
import {
  generateGatedText,
  requiredGatedText,
  throwIfAborted,
  type GenerationOutcome,
} from '@/services/content/generate-text';
import { maySegmentStream } from '@/services/content/streaming-kinds';
import type {
  ApiModelContext,
  MoveIdentity,
  TurnContentDeps,
} from '@/services/content/turn-content.types';
import { fallbackText } from '@/services/content/turn-fallback';
import { contextEvidence, resolveQuestion, retryAsk } from '@/services/content/turn-question';
import { isDetour, responseMove } from '@/services/content/turn-response';
import { streamGatedText } from '@/services/content/turn-stream';

export type { ApiModelContext } from '@/services/content/turn-content.types';

export type TurnContentService = Readonly<{
  resolve(turn: PlannedTurn<ApiModelContext>, signal?: AbortSignal): Promise<ResolvedContent>;
}>;

export function createTurnContentService(deps: TurnContentDeps): TurnContentService {
  return {
    resolve: (turn: PlannedTurn<ApiModelContext>, signal?: AbortSignal) =>
      resolve(deps, turn, signal),
  };
}

/** What Aria says this turn, and where the words came from. */
type Said = Readonly<{
  text: string;
  provenance: Readonly<Record<string, unknown>>;
  identity?: MoveIdentity;
}>;

async function resolve(
  deps: TurnContentDeps,
  turn: PlannedTurn<ApiModelContext>,
  signal?: AbortSignal,
): Promise<ResolvedContent> {
  throwIfAborted(signal);
  if (turn.plan.kind === 'ASK') return resolveQuestion(deps, turn, signal);
  const reviewed = reviewedText(deps, turn);
  if (reviewed !== null) {
    const text = requiredGatedText(deps.gate, reviewed.text, turn.context.session.band);
    return responseWithContinuation(deps, turn, { text, provenance: reviewed.provenance }, signal);
  }
  const said = await generated(deps, turn, signal);
  throwIfAborted(signal);
  return responseWithContinuation(deps, turn, said, signal);
}

/** A sentence somebody already approved: the scripted one, or a misconception's remediation. */
function reviewedText(
  deps: TurnContentDeps,
  turn: PlannedTurn<ApiModelContext>,
): Readonly<{ text: string; provenance: Readonly<Record<string, unknown>> }> | null {
  const scripted = fixedText(turn);
  if (scripted !== null) {
    return { text: scripted, provenance: { responseSource: 'reviewed-fixed' } };
  }
  return currentRemediation(deps, turn);
}

/** Aria's own words: streamed a sentence at a time where that is safe, buffered otherwise. */
async function generated(
  deps: TurnContentDeps,
  turn: PlannedTurn<ApiModelContext>,
  signal?: AbortSignal,
): Promise<Said> {
  const identity = streamIdentity(deps, turn);
  const outcome =
    identity === null
      ? await generateGatedText(deps, turn, signal)
      : await streamGatedText(streamDeps(deps), turn, identity, signal);
  if (outcome.kind === 'generated') {
    return {
      text: outcome.text,
      provenance: provenance(outcome),
      ...(identity === null ? {} : { identity }),
    };
  }
  (deps.observer ?? NULL_TURN_CONTENT_OBSERVER).fallbackUsed(turn.plan.kind, outcome.reason);
  return {
    text: requiredGatedText(deps.gate, fallbackText(turn), turn.context.session.band),
    provenance: provenance(outcome),
  };
}

/**
 * P2H-07: a streamed move is named before its first sentence leaves.
 *
 * The segments and the move that finally arrives have to be the same thing, or a client would
 * speak the sentences and then speak them again. Streaming is off unless something is listening
 * — a buffered client is still a supported client, and generating into nothing costs a turn.
 */
function streamIdentity(
  deps: TurnContentDeps,
  turn: PlannedTurn<ApiModelContext>,
): MoveIdentity | null {
  const { respond, segments, ids } = deps;
  if (respond === undefined || segments === undefined || ids === undefined) return null;
  if (!maySegmentStream(turn.plan.kind, turn.context.session.band)) return null;
  if (!segments.listening(turn.context.session.id)) return null;
  return { id: ids.next(), generationId: ids.next() };
}

function streamDeps(deps: TurnContentDeps): Parameters<typeof streamGatedText>[0] {
  if (deps.respond === undefined || deps.segments === undefined) {
    throw new Error('Streaming was chosen without a streamer');
  }
  return { respond: deps.respond, segments: deps.segments };
}

/**
 * P2H-02/P2H-03: where Aria's *words* came from, and which prompt made them.
 *
 * Deliberately not `contentSource`: that key already means where the practice *item* came
 * from, and a PRAISE followed by a new question carries both in one evidence row.
 */
function provenance(outcome: GenerationOutcome): Readonly<Record<string, unknown>> {
  return outcome.kind === 'generated'
    ? {
        responseSource: 'model',
        promptName: outcome.promptName,
        promptVersion: outcome.promptVersion,
      }
    : { responseSource: 'fallback', fallbackReason: outcome.reason };
}

function currentRemediation(
  deps: TurnContentDeps,
  turn: PlannedTurn<ApiModelContext>,
): Readonly<{ text: string; provenance: Readonly<Record<string, unknown>> }> | null {
  const id =
    turn.plan.kind === 'RETEACH'
      ? (turn.decision.graded?.misconception ?? turn.context.session.repeatedMisconception)
      : null;
  const text = id === null ? null : deps.remediation(id);
  return text === null ? null : { text, provenance: { responseSource: 'reviewed-remediation' } };
}

async function responseWithContinuation(
  deps: TurnContentDeps,
  turn: PlannedTurn<ApiModelContext>,
  said: Said,
  signal?: AbortSignal,
): Promise<ResolvedContent> {
  const feedback = responseMove(
    deps.moves(turn.context.session.id),
    turn,
    said.text,
    said.identity,
  );
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
