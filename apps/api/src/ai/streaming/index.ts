export { createGatedStreamer, SEGMENT_GATE_BUDGET_MS } from '@/ai/streaming/gated-stream';
export { MovePlanValidationError, StreamGateError } from '@/errors';
export { validateMovePlan } from '@/ai/streaming/move-plan';
export { mayStreamBySentence } from '@/ai/streaming/policy';
export { SentenceSegmenter } from '@/ai/streaming/segmenter';
export { spokenForm } from '@/ai/streaming/spoken-form';
export type {
  GatedStreamer,
  GatedStreamInput,
  MovePlan,
  MovePlanResult,
  ReleasedSegment,
  SpokenContext,
  StreamContentKind,
} from '@/ai/streaming/types';
