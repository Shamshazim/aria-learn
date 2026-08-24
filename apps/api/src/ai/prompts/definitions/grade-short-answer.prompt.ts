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
  version: '1.0.0',
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
