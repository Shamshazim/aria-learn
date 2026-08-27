import type { Band, MoveKind } from '@aria/shared';
import type { Intent } from '@aria/tutor';

import type { ModelTier } from '@/ai/provider';
import type { ScrubbedContext } from '@/privacy';

import type { ZodType } from 'zod';

type ContextInput = Readonly<{ context: ScrubbedContext }>;

export type ExplainPromptInput = ContextInput &
  Readonly<{ concept: string; learnerQuestion: string; approach: string }>;
export type ExplainPromptOutput = Readonly<{ explanation: string }>;

export type HintPromptInput = ContextInput &
  Readonly<{ problem: string; learnerAnswer?: string | undefined }>;
export type HintPromptOutput = Readonly<{ hint: string }>;

export type MemoryProposalsPromptInput = ContextInput & Readonly<{ eventIds: readonly string[] }>;
export type MemoryProposalsPromptOutput = Readonly<{
  proposals: readonly Readonly<{
    kind: string;
    text: string;
    confidence: number;
    temporary: boolean;
    sourceEventId: string;
    skillCode: string | null;
  }>[];
}>;

export type PracticeItemPromptInput = ContextInput &
  Readonly<{ skill: string; difficulty: 'easier' | 'same' | 'harder' }>;
export type PracticeItemPromptOutput = Readonly<{
  prompt: string;
  answer: string;
  options?: readonly Readonly<{ id: string; text: string }>[] | undefined;
  answerKey?: string | undefined;
}>;

export type GradeShortAnswerPromptInput = ContextInput &
  Readonly<{ question: string; expectedAnswer: string; learnerAnswer: string }>;
export type GradeShortAnswerPromptOutput = Readonly<{
  verdict: 'correct' | 'incorrect';
  feedback: string;
}>;

/** Every child-facing move except ASK is generated through one persona prompt (P2H-03). */
export type RespondPromptInput = ContextInput &
  Readonly<{
    band: Band;
    move: string;
    approach: string;
    subject: string;
    skill?: string | undefined;
    /** P2H-10: the skill's teaching note, rendered. Absent where no note applies. */
    lesson?: string | undefined;
    /** P2H-11: what this turn knows the child did, for the moves that make claims about them. */
    moveInputs?: string | undefined;
    question?: string | undefined;
    learnerSaid?: string | undefined;
    answerKey?: string | undefined;
    correct?: boolean | undefined;
  }>;
export type RespondPromptOutput = Readonly<{ text: string }>;
/** P2H-07: the streamed twin of `respond`; the same words, released a sentence at a time. */
export type RespondStreamPromptOutput = RespondPromptOutput;

/** P2H-05: the model second pass over what a child meant. */
export type ClassifyIntentPromptInput = ContextInput &
  Readonly<{ utterance: string; question: string }>;
export type ClassifyIntentPromptOutput = Readonly<{ intent: Intent; confidence: number }>;

/**
 * P2H-06: the planner's move selection. There is no answer key in this contract, and adding
 * one would be a privacy and pedagogy regression, not a convenience.
 */
export type PlanMovePromptInput = ContextInput &
  Readonly<{
    band: Band;
    skill: string;
    question: string;
    learnerSaid: string;
    state: string;
    recentIntents: string;
    allowed: readonly MoveKind[];
  }>;
export type PlanMovePromptOutput = Readonly<{
  kind: MoveKind;
  approach: string;
  rationale: string;
  confidence: number;
}>;

export type SafetyCategory =
  'adult-content' | 'frightening' | 'personal-information' | 'violence' | 'other';
export type ClassifySafetyPromptInput = ContextInput & Readonly<{ content: string }>;
export type ClassifySafetyPromptOutput =
  Readonly<{ verdict: 'safe' }> | Readonly<{ verdict: 'unsafe'; category: SafetyCategory }>;

export type PromptContractMap = {
  'classify-intent': { input: ClassifyIntentPromptInput; output: ClassifyIntentPromptOutput };
  'classify-safety': {
    input: ClassifySafetyPromptInput;
    output: ClassifySafetyPromptOutput;
  };
  explain: { input: ExplainPromptInput; output: ExplainPromptOutput };
  'grade-short-answer': {
    input: GradeShortAnswerPromptInput;
    output: GradeShortAnswerPromptOutput;
  };
  hint: { input: HintPromptInput; output: HintPromptOutput };
  'memory-proposals': {
    input: MemoryProposalsPromptInput;
    output: MemoryProposalsPromptOutput;
  };
  'plan-move': { input: PlanMovePromptInput; output: PlanMovePromptOutput };
  'practice-item': { input: PracticeItemPromptInput; output: PracticeItemPromptOutput };
  respond: { input: RespondPromptInput; output: RespondPromptOutput };
  'respond-stream': { input: RespondPromptInput; output: RespondStreamPromptOutput };
};

export type PromptName = keyof PromptContractMap;
export type PromptInput<Name extends PromptName> = PromptContractMap[Name]['input'];
export type PromptOutput<Name extends PromptName> = PromptContractMap[Name]['output'];

export type PromptDefinition<Name extends PromptName> = Readonly<{
  name: Name;
  version: string;
  tier: ModelTier;
  system: string;
  inputSchema: ZodType<PromptInput<Name>>;
  render(input: PromptInput<Name>): string;
  outputSchema: ZodType<PromptOutput<Name>>;
  maxTokens: number;
  jsonMode: boolean;
}>;

export type PromptRegistry = { [Name in PromptName]: PromptDefinition<Name> };
