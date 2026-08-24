import { z } from 'zod';

import { promptTextSchema, scrubbedContextSchema } from '@/ai/prompts/input.schema';
import { renderPrompt } from '@/ai/prompts/render/render';
import type {
  PracticeItemPromptInput,
  PracticeItemPromptOutput,
  PromptDefinition,
} from '@/ai/prompts/types';

const TEMPLATE = `Create one practice item for the requested skill.

Learner context:
{{learnerContext}}

Skill: {{skill}}
Difficulty relative to current work: {{difficulty}}

Return JSON with fields "prompt" and "answer". When the requested skill says multiple choice,
also return three or four distinct options as objects with "id" and "text", and "answerKey"
equal to the id of the one option whose text matches the answer.`;

const outputSchema: z.ZodType<PracticeItemPromptOutput> = z
  .object({
    prompt: z.string().trim().min(1).max(2_000),
    answer: z.string().trim().min(1).max(500),
    options: z
      .array(z.object({ id: z.string().min(1), text: z.string().min(1) }).strict())
      .min(3)
      .max(4)
      .optional(),
    answerKey: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((output, context) => {
    if ((output.options === undefined) === (output.answerKey === undefined)) return;
    context.addIssue({ code: 'custom', message: 'options and answerKey must appear together' });
  });
const inputSchema: z.ZodType<PracticeItemPromptInput> = z
  .object({
    context: scrubbedContextSchema,
    skill: promptTextSchema,
    difficulty: z.enum(['easier', 'same', 'harder']),
  })
  .strict();

export const practiceItemPrompt: PromptDefinition<'practice-item'> = {
  name: 'practice-item',
  version: '1.1.0',
  tier: 'TEACH',
  system: 'You are Aria, a precise curriculum writer for children. Give only the requested JSON.',
  inputSchema,
  render: (input) =>
    renderPrompt(TEMPLATE, input.context, {
      learnerContext: JSON.stringify(input.context.value),
      skill: input.skill,
      difficulty: input.difficulty,
    }),
  outputSchema,
  maxTokens: 500,
  jsonMode: true,
};
