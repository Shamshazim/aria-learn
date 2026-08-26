import type { TutorMove, VisualContent } from '@aria/shared';

import type { AiClient, RespondStreamer } from '@/ai';
import type { ReliableContentService } from '@/content/content.service';
import type { LessonNote } from '@/curriculum';
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
  /** P2H-10: the teaching note for the skill in play, so a prompt is grounded in it. */
  lesson: LessonNote | null;
  completionOnly: boolean;
  latestAsk: Extract<TutorMove, { kind: 'ASK' }> | null;
}>;

export type TurnContentDeps = Readonly<{
  reliable: ReliableContentService;
  ai: AiClient | null;
  gate: QualityGate;
  moves(sessionId: string): MoveFactory;
  remediation(misconceptionId: string): string | null;
  /**
   * P2H-10: the visual model for this skill, drawn for the open item, or nothing.
   *
   * Injected rather than imported so the turn path stays free of the curriculum: which
   * picture a skill gets, and what it is captioned, are authoring decisions. This service
   * only decides *whether* the move it is building should carry one.
   */
  visual(
    input: Readonly<{
      skillCode: string;
      problem: ArithmeticProblem | null;
      /** The wrong idea being reteached, whose own model captions the picture when there is one. */
      misconceptionId: string | null;
    }>,
  ): VisualContent | null;
  observer?: TurnContentObserver;
  /**
   * P2H-07: everything needed to say an answer before it is finished, or nothing.
   *
   * The three arrive together because they are useless apart: a streamer with nowhere to publish
   * generates into the void, and a bus with no streamer never sees a sentence. One optional
   * object says that; three optional fields would have let a deployment be half-configured.
   */
  streaming?: StreamingDeps;
}>;

export type StreamingDeps = Readonly<{
  /** Aria's words, a sentence at a time. */
  respond: RespondStreamer;
  /** Where a released sentence goes while the rest is still being written. */
  segments: SegmentBus;
  /** Names a streamed move before its first sentence leaves. */
  ids: IdGenerator;
}>;

/** P2H-07: the identity a streamed move is given before its first sentence leaves. */
export type MoveIdentity = Readonly<{ id: string; generationId: string }>;
