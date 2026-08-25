import type { PlannedTurn } from '@aria/tutor';

import { StreamGateError, type GatedSegment, type RespondStreamer } from '@/ai';
import type { FallbackReason } from '@/observability/content-metrics';
import type { GenerationOutcome } from '@/services/content/generate-text';
import { throwIfAborted } from '@/services/content/generate-text';
import type { SegmentBus } from '@/services/content/segment-bus';
import type { ApiModelContext, MoveIdentity } from '@/services/content/turn-content.types';
import { fallbackText } from '@/services/content/turn-fallback';
import { respondInput } from '@/services/content/turn-response';

export type StreamedText = GenerationOutcome & Readonly<{ identity: MoveIdentity }>;

/**
 * P2H-07: says the answer while it is still being written.
 *
 * Every sentence has already passed the gate before it is published — the streamer releases
 * nothing else — so the child hears the first one while the model is on the third, and no
 * unchecked word ever reaches a speaker. The assembled text is still returned, because the move
 * that gets committed and replayed has to be the whole thing.
 */
export async function streamGatedText(
  deps: Readonly<{ respond: RespondStreamer; segments: SegmentBus }>,
  turn: PlannedTurn<ApiModelContext>,
  identity: MoveIdentity,
  signal?: AbortSignal,
): Promise<StreamedText> {
  const written: string[] = [];
  try {
    for await (const segment of deps.respond.stream(streamInput(turn, signal))) {
      throwIfAborted(signal);
      written.push(segment.written);
      deps.segments.publish(turn.context.session.id, published(identity, segment));
    }
  } catch (error) {
    throwIfAborted(signal);
    if (written.length === 0) return { kind: 'fallback', reason: providerReason(error), identity };
  }
  return written.length === 0
    ? { kind: 'fallback', reason: 'gate_failed', identity }
    : {
        kind: 'generated',
        text: written.join(' '),
        promptName: 'respond-stream',
        promptVersion: '1.0.0',
        identity,
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
 * Nothing was released, so the child heard nothing and the turn falls back as it always did.
 * The gate has its own path — a reviewed closing sentence — and only reaches here when even
 * that sentence fails, which is a content defect rather than an outage.
 */
function providerReason(error: unknown): FallbackReason {
  return error instanceof StreamGateError ? 'gate_failed' : 'provider_error';
}

function streamInput(
  turn: PlannedTurn<ApiModelContext>,
  signal?: AbortSignal,
): Parameters<RespondStreamer['stream']>[0] {
  const band = turn.context.session.band;
  return {
    promptInput: respondInput(turn),
    studentId: turn.context.session.studentId,
    plan: {
      moveKind: turn.plan.kind,
      band,
      answerJudgement: judgement(turn),
      teachingClaim: turn.plan.reason,
      responseType: 'none',
    },
    contentKind: 'explanation',
    gateInput: (text) => ({
      id: 'turn-text',
      kind: 'text',
      band,
      childText: text,
      factual: false,
      grounding: 'unsupported',
    }),
    fallbackText: fallbackText(turn),
    ...(signal === undefined ? {} : { signal }),
  };
}

function judgement(turn: PlannedTurn<ApiModelContext>): 'correct' | 'incorrect' | 'not-applicable' {
  const graded = turn.decision.graded;
  if (graded === null) return 'not-applicable';
  return graded.correct ? 'correct' : 'incorrect';
}
