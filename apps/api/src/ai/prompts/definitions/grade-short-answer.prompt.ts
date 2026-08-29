import { z } from 'zod';

import { promptTextSchema, scrubbedContextSchema } from '@/ai/prompts/input.schema';
import { renderPrompt } from '@/ai/prompts/render/render';
import type {
  GradeShortAnswerPromptInput,
  GradeShortAnswerPromptOutput,
  PromptDefinition,
} from '@/ai/prompts/types';

const TEMPLATE = `Grade the learner's short answer against the expected answer.

Learner context:
{{learnerContext}}

Question: {{question}}
Expected answer: {{expectedAnswer}}
Learner answer: {{learnerAnswer}}

The learner answered out loud, so the words may be a transcript: numbers spelled out, parts
given in a different order, or extra words around the answer. Mark "correct" when what the
learner said means the same as the expected answer, in any wording or order. Mark
"incorrect" only when the meaning differs or a required part is missing.

Return JSON with "verdict" ("correct" or "incorrect") and child-facing "feedback".`;

const outputSchema: z.ZodType<GradeShortAnswerPromptOutput> = z
  .object({
    verdict: z.enum(['correct', 'incorrect']),
    feedback: z.string().trim().min(1).max(1_000),
  })
  .strict();
const inputSchema: z.ZodType<GradeShortAnswerPromptInput> = z
  .object({
    context: scrubbedContextSchema,
    question: promptTextSchema,
    expectedAnswer: promptTextSchema,
    learnerAnswer: promptTextSchema,
  })
  .strict();

export const gradeShortAnswerPrompt: PromptDefinition<'grade-short-answer'> = {
  name: 'grade-short-answer',
  version: '1.1.0',
  tier: 'FAST',
  system: 'You are Aria, a fair evaluator of short learner answers. Give only the requested JSON.',
  inputSchema,
  render: (input) =>
    renderPrompt(TEMPLATE, input.context, {
      learnerContext: JSON.stringify(input.context.value),
      question: input.question,
      expectedAnswer: input.expectedAnswer,
      learnerAnswer: input.learnerAnswer,
    }),
  outputSchema,
  maxTokens: 250,
  jsonMode: true,
};
