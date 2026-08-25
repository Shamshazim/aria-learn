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

export type SafetyCategory =
  'adult-content' | 'frightening' | 'personal-information' | 'violence' | 'other';
export type ClassifySafetyPromptInput = ContextInput & Readonly<{ content: string }>;
export type ClassifySafetyPromptOutput =
  Readonly<{ verdict: 'safe' }> | Readonly<{ verdict: 'unsafe'; category: SafetyCategory }>;

export type PromptContractMap = {
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
  'practice-item': { input: PracticeItemPromptInput; output: PracticeItemPromptOutput };
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
