import type { PlannedTurn, ResolvedContent } from '@aria/tutor';

import type { StreamContentKind } from '@/ai';
import {
  NULL_TURN_CONTENT_OBSERVER,
  type TurnContentObserver,
} from '@/observability/content-metrics';
import { fixedText } from '@/services/content/fixed-text';
import {
  generateGatedText,
  requiredGatedText,
  throwIfAborted,
  type GenerationOutcome,
} from '@/services/content/generate-text';
import { segmentContentKind } from '@/services/content/streaming-kinds';
import type {
  ApiModelContext,
  MoveIdentity,
  StreamingDeps,
  TurnContentDeps,
} from '@/services/content/turn-content.types';
import { fallbackText } from '@/services/content/turn-fallback';
import { contextEvidence, resolveQuestion, retryAsk } from '@/services/content/turn-question';
import { isDetour, responseMove } from '@/services/content/turn-response';
import { streamGatedText } from '@/services/content/turn-stream';
import { visualMove } from '@/services/content/turn-visual';

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
  const streaming = streamingFor(deps, turn);
  if (streaming === null) return buffered(deps, turn, await generateGatedText(deps, turn, signal));
  const outcome = await streamGatedText(streaming.deps, turn, streaming, signal);
  if (outcome.kind !== 'generated') return buffered(deps, turn, outcome);
  if (outcome.truncated !== undefined) {
    observerFor(deps).streamTruncated(
      turn.plan.kind,
      outcome.truncated.reason,
      outcome.truncated.error,
    );
  }
  return {
    text: outcome.text,
    provenance: {
      ...provenance(outcome),
      ...(outcome.truncated === undefined ? {} : { streamTruncated: outcome.truncated.reason }),
    },
    identity: streaming.identity,
  };
}

/** The turn said nothing of its own, so a reviewed sentence says it instead. */
function buffered(
  deps: TurnContentDeps,
  turn: PlannedTurn<ApiModelContext>,
  outcome: GenerationOutcome,
): Said {
  if (outcome.kind === 'generated') {
    return { text: outcome.text, provenance: provenance(outcome) };
  }
  observerFor(deps).fallbackUsed(turn.plan.kind, outcome.reason);
  return {
    text: requiredGatedText(deps.gate, fallbackText(turn), turn.context.session.band),
    provenance: provenance(outcome),
  };
}

function observerFor(deps: TurnContentDeps): TurnContentObserver {
  return deps.observer ?? NULL_TURN_CONTENT_OBSERVER;
}

/**
 * P2H-07: a streamed move is named before its first sentence leaves.
 *
 * The segments and the move that finally arrives have to be the same thing, or a client would
 * speak the sentences and then speak them again. Streaming is off unless something is listening
 * — a buffered client is still a supported client, and generating into nothing costs a turn.
 */
function streamingFor(
  deps: TurnContentDeps,
  turn: PlannedTurn<ApiModelContext>,
): Readonly<{
  deps: StreamingDeps;
  identity: MoveIdentity;
  contentKind: StreamContentKind;
}> | null {
  const streaming = deps.streaming;
  if (streaming === undefined) return null;
  const contentKind = segmentContentKind(turn.plan.kind, turn.context.session.band);
  if (contentKind === null) return null;
  if (!streaming.segments.listening(turn.context.session.id)) return null;
  return {
    deps: streaming,
    identity: { id: streaming.ids.next(), generationId: streaming.ids.next() },
    contentKind,
  };
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
    // P2H-10: the picture goes between the explanation and the question it was about, so the
    // child is looking at it while the item comes back.
    const shown = visualMove(deps, turn);
    const prior = turn.context.modelContext.latestAsk;
    const followUp = prior === null ? [] : [retryAsk(deps, turn, prior, !detour)];
    return {
      moves: [feedback, ...(shown === null ? [] : [shown]), ...followUp],
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
