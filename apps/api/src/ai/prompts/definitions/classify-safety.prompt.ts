import { z } from 'zod';

import { promptTextSchema, scrubbedContextSchema } from '@/ai/prompts/input.schema';
import { renderPrompt } from '@/ai/prompts/render/render';
import type {
  ClassifySafetyPromptInput,
  ClassifySafetyPromptOutput,
  PromptDefinition,
} from '@/ai/prompts/types';

const TEMPLATE = `Classify whether this content is safe to show a child.

Content: {{content}}

Return {"verdict":"safe"}, or return "verdict" as "unsafe" with one category.`;

const outputSchema: z.ZodType<ClassifySafetyPromptOutput> = z.discriminatedUnion('verdict', [
  z.object({ verdict: z.literal('safe') }).strict(),
  z
    .object({
      verdict: z.literal('unsafe'),
      category: z.enum([
        'adult-content',
        'frightening',
        'personal-information',
        'violence',
        'other',
      ]),
    })
    .strict(),
]);
const inputSchema: z.ZodType<ClassifySafetyPromptInput> = z
  .object({ context: scrubbedContextSchema, content: promptTextSchema })
  .strict();

export const classifySafetyPrompt: PromptDefinition<'classify-safety'> = {
  name: 'classify-safety',
  version: '1.0.0',
  tier: 'FAST',
  system: 'Classify child-facing content conservatively. Give only the requested JSON.',
  inputSchema,
  render: (input) => renderPrompt(TEMPLATE, input.context, { content: input.content }),
  outputSchema,
  maxTokens: 150,
  jsonMode: true,
};
