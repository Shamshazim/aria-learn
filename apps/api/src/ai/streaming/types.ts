import type { Band, Expects, MoveKind } from '@aria/shared';

import type { LlmRequest } from '@/ai/provider';
import type { GateInput } from '@/quality';
import type { ArithmeticProblem } from '@/quality/arithmetic';

export type StreamContentKind =
  'explanation' | 'multiple-choice' | 'arithmetic' | 'decodable-passage' | (string & {});

export type MovePlan = Readonly<{
  moveKind: MoveKind;
  band: Band;
  answerJudgement: 'correct' | 'incorrect' | 'not-applicable';
  teachingClaim: string;
  verifiedContentId?: string;
  responseType: Expects;
  arithmetic?: Readonly<{ problem: ArithmeticProblem; candidate: string }>;
}>;

export type MovePlanResult =
  Readonly<{ valid: true }> | Readonly<{ valid: false; reasons: readonly string[] }>;

export type ReleasedSegment = Readonly<{
  written: string;
  spoken: string;
  gateMs: number;
  /** P2H-07: position in this generation. The consumer speaks `n` only after `n - 1`. */
  index: number;
  /** P2H-07: known-final. See `moveSegmentSchema` for why a stream may never set it. */
  isLast: boolean;
  /**
   * P2H-11: this sentence is the reviewed closing text, not the model's.
   *
   * The gate refused what the model wrote next, so the turn was closed with a static string.
   * The child heard one, which means it has to be counted and logged like any other — a
   * segment that says nothing about where it came from is how that stopped happening.
   */
  substituted?: boolean;
}>;

export type GatedStreamInput = Readonly<{
  plan: MovePlan;
  request: LlmRequest;
  contentKind: StreamContentKind;
  gateInput: (text: string) => GateInput;
  fallbackText: string;
  spokenContext?: SpokenContext;
  signal?: AbortSignal;
}>;

export type GatedStreamer = Readonly<{
  stream(input: GatedStreamInput): AsyncIterable<ReleasedSegment>;
}>;

export type SpokenContext = 'default' | 'place-value' | 'phoneme';
