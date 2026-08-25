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
