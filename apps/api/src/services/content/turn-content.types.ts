import type { TutorMove } from '@aria/shared';

import type { AiClient, RespondStreamer } from '@/ai';
import type { ReliableContentService } from '@/content/content.service';
import type { IdGenerator } from '@/lib/ids';
import type { TurnContentObserver } from '@/observability/content-metrics';
import type { ScrubbedContext } from '@/privacy';
import type { QualityGate } from '@/quality';
import type { ArithmeticProblem } from '@/quality/arithmetic';
import type { SegmentBus } from '@/services/content/segment-bus';
import type { MoveFactory } from '@/services/moves/move-factory';

export type ApiModelContext = Readonly<{
  scrubbed: ScrubbedContext;
  answerKey: string | null;
  latestQuestion: string | null;
  estimatedTokens: number;
  retrievedFactIds: readonly string[];
  recentContentItemIds: readonly string[];
  /** P2H-06: the child's last few classified intents, oldest first, for the planner. */
  recentIntents: readonly string[];
  arithmeticProblem: ArithmeticProblem | null;
  completionOnly: boolean;
  latestAsk: Extract<TutorMove, { kind: 'ASK' }> | null;
}>;

export type TurnContentDeps = Readonly<{
  reliable: ReliableContentService;
  ai: AiClient | null;
  gate: QualityGate;
  moves(sessionId: string): MoveFactory;
  remediation(misconceptionId: string): string | null;
  observer?: TurnContentObserver;
  /** P2H-07: Aria's words, a sentence at a time. Absent means every move arrives whole. */
  respond?: RespondStreamer;
  /** P2H-07: where a released sentence goes while the rest is still being written. */
  segments?: SegmentBus;
  ids?: IdGenerator;
}>;

/** P2H-07: the identity a streamed move is given before its first sentence leaves. */
export type MoveIdentity = Readonly<{ id: string; generationId: string }>;
