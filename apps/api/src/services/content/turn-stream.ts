import type { PlannedTurn } from '@aria/tutor';

import {
  StreamGateError,
  type GatedSegment,
  type RespondStreamer,
  type StreamContentKind,
} from '@/ai';
import type { FallbackReason } from '@/observability/content-metrics';
import type { GenerationOutcome } from '@/services/content/generate-text';
import { throwIfAborted } from '@/services/content/generate-text';
import type { MoveInputs } from '@/services/content/move-inputs';
import type {
  ApiModelContext,
  MoveIdentity,
  StreamingDeps,
} from '@/services/content/turn-content.types';
import { respondInput } from '@/services/content/turn-response';

/**
 * Everything the stream needs that is decided before the first token (P2H-07, P2H-11).
 *
 * The reviewed closing sentence is chosen up front rather than when the stream breaks: the
 * picker is the only thing that knows which variant this session heard last, and asking it
 * mid-failure would mean building a fallback while handling one.
 */
export type StreamRelease = Readonly<{
  identity: MoveIdentity;
  contentKind: StreamContentKind;
  inputs: MoveInputs;
  fallbackText: string;
}>;

/**
 * A streamed answer, and — when the stream stopped after the child had already heard some of it
 * — why it stopped. A truncated answer is still the child's own answer, so it is `generated`;
 * `truncated` is what stops that from being the whole story (P2H-07).
 */
export type StreamedText = GenerationOutcome &
  Readonly<{
    identity: MoveIdentity;
    truncated?: Readonly<{ reason: FallbackReason; error: unknown }>;
    /** P2H-11: the turn was closed with the reviewed static sentence, and a child heard it. */
    substituted?: boolean;
  }>;

/**
 * P2H-07: says the answer while it is still being written.
 *
 * Every sentence has already passed the gate before it is published — the streamer releases
 * nothing else — so the child hears the first one while the model is on the third, and no
 * unchecked word ever reaches a speaker. The assembled text is still returned, because the move
 * that gets committed and replayed has to be the whole thing.
 */
export async function streamGatedText(
  deps: StreamingDeps,
  turn: PlannedTurn<ApiModelContext>,
  release: StreamRelease,
  signal?: AbortSignal,
): Promise<StreamedText> {
  const { identity } = release;
  const written: string[] = [];
  let failure: unknown = null;
  let substituted = false;
  try {
    for await (const segment of deps.respond.stream(streamInput(turn, release, signal))) {
      throwIfAborted(signal);
      written.push(segment.written);
      substituted ||= segment.substituted === true;
      deps.segments.publish(turn.context.session.id, published(identity, segment));
    }
  } catch (error) {
    throwIfAborted(signal);
    failure = error;
  }
  if (written.length === 0) {
    return { kind: 'fallback', reason: providerReason(failure), identity };
  }
  return {
    kind: 'generated',
    text: written.join(' '),
    promptName: 'respond-stream',
    promptVersion: '1.0.0',
    identity,
    ...(substituted ? { substituted: true } : {}),
    // The child heard the sentences before the break; the record has to say the rest never came.
    ...(failure === null ? {} : { truncated: { reason: providerReason(failure), error: failure } }),
  };
}

function published(
  identity: MoveIdentity,
  segment: Readonly<{ written: string; spoken: string; index: number; isLast: boolean }>,
): GatedSegment {
  return {
    generationId: identity.generationId,
    moveId: identity.id,
    index: segment.index,
    text: segment.written,
    speech: segment.spoken,
    isLast: segment.isLast,
  };
}

/**
 * The gate has its own path — a reviewed closing sentence — and reaches here only when even that
 * sentence fails, which is a content defect rather than an outage. A stream that ended with no
 * error and no sentences is the same defect: the gate refused everything it was offered.
 */
function providerReason(error: unknown): FallbackReason {
  if (error === null) return 'gate_failed';
  return error instanceof StreamGateError ? 'gate_failed' : 'provider_error';
}

function streamInput(
  turn: PlannedTurn<ApiModelContext>,
  release: StreamRelease,
  signal?: AbortSignal,
): Parameters<RespondStreamer['stream']>[0] {
  const band = turn.context.session.band;
  const claims = release.inputs.claims;
  return {
    promptInput: respondInput(turn, release.inputs),
    studentId: turn.context.session.studentId,
    plan: {
      moveKind: turn.plan.kind,
      band,
      answerJudgement: judgement(turn),
      teachingClaim: turn.plan.reason,
      responseType: 'none',
    },
    contentKind: release.contentKind,
    gateInput: (text) => ({
      id: 'turn-text',
      kind: 'text',
      band,
      childText: text,
      factual: false,
      grounding: 'unsupported',
      ...(claims === undefined ? {} : { claims }),
    }),
    fallbackText: release.fallbackText,
    ...(signal === undefined ? {} : { signal }),
  };
}

function judgement(turn: PlannedTurn<ApiModelContext>): 'correct' | 'incorrect' | 'not-applicable' {
  const graded = turn.decision.graded;
  if (graded === null) return 'not-applicable';
  return graded.correct ? 'correct' : 'incorrect';
}
