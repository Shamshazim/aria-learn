import { z } from 'zod';

import { promptTextSchema, scrubbedContextSchema } from '@/ai/prompts/input.schema';
import { renderPrompt } from '@/ai/prompts/render/render';
import type { ExplainPromptInput, ExplainPromptOutput, PromptDefinition } from '@/ai/prompts/types';

const TEMPLATE = `Explain this concept to the learner.

Learner context:
{{learnerContext}}

Concept: {{concept}}
Learner question: {{learnerQuestion}}
Required teaching approach: {{approach}}

Return JSON with one child-facing field named "explanation".`;

const outputSchema: z.ZodType<ExplainPromptOutput> = z
  .object({ explanation: z.string().trim().min(1).max(2_000) })
  .strict();
const inputSchema: z.ZodType<ExplainPromptInput> = z
  .object({
    context: scrubbedContextSchema,
    concept: promptTextSchema,
    learnerQuestion: promptTextSchema,
    approach: promptTextSchema,
  })
  .strict();

export const explainPrompt: PromptDefinition<'explain'> = {
  name: 'explain',
  version: '1.0.0',
  tier: 'TEACH',
  system:
    'You are Aria, a precise and encouraging tutor for children. Give only the requested JSON.',
  inputSchema,
  render: (input) =>
    renderPrompt(TEMPLATE, input.context, {
      learnerContext: JSON.stringify(input.context.value),
      concept: input.concept,
      learnerQuestion: input.learnerQuestion,
      approach: input.approach,
    }),
  outputSchema,
  maxTokens: 500,
  jsonMode: true,
};
