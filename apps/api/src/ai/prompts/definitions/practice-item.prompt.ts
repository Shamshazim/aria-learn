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

Return JSON with fields "prompt" and "answer".`;

const outputSchema: z.ZodType<PracticeItemPromptOutput> = z
  .object({
    prompt: z.string().trim().min(1).max(2_000),
    answer: z.string().trim().min(1).max(500),
  })
  .strict();
const inputSchema: z.ZodType<PracticeItemPromptInput> = z
  .object({
    context: scrubbedContextSchema,
    skill: promptTextSchema,
    difficulty: z.enum(['easier', 'same', 'harder']),
  })
  .strict();

export const practiceItemPrompt: PromptDefinition<'practice-item'> = {
  name: 'practice-item',
  version: '1.0.0',
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
