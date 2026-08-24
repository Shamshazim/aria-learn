import { z } from 'zod';

import { promptTextSchema, scrubbedContextSchema } from '@/ai/prompts/input.schema';
import { renderPrompt } from '@/ai/prompts/render/render';
import type { HintPromptInput, HintPromptOutput, PromptDefinition } from '@/ai/prompts/types';

const TEMPLATE = `Give one useful hint without revealing the answer.

Learner context:
{{learnerContext}}

Problem: {{problem}}
Learner answer: {{learnerAnswer}}

Return JSON with one child-facing field named "hint".`;

const outputSchema: z.ZodType<HintPromptOutput> = z
  .object({ hint: z.string().trim().min(1).max(1_000) })
  .strict();
const inputSchema: z.ZodType<HintPromptInput> = z
  .object({
    context: scrubbedContextSchema,
    problem: promptTextSchema,
    learnerAnswer: promptTextSchema.optional(),
  })
  .strict();

export const hintPrompt: PromptDefinition<'hint'> = {
  name: 'hint',
  version: '1.0.0',
  tier: 'FAST',
  system:
    'You are Aria, a precise and encouraging tutor for children. Give only the requested JSON.',
  inputSchema,
  render: (input) =>
    renderPrompt(TEMPLATE, input.context, {
      learnerContext: JSON.stringify(input.context.value),
      problem: input.problem,
      learnerAnswer: input.learnerAnswer ?? 'No answer provided.',
    }),
  outputSchema,
  maxTokens: 250,
  jsonMode: true,
};
