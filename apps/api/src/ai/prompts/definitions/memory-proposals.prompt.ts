import { z } from 'zod';

import { scrubbedContextSchema } from '@/ai/prompts/input.schema';
import { renderPrompt } from '@/ai/prompts/render/render';
import type {
  MemoryProposalsPromptInput,
  MemoryProposalsPromptOutput,
  PromptDefinition,
} from '@/ai/prompts/types';

const TEMPLATE = `Propose only parent-displayable learner facts directly supported by the evidence.

Scrubbed learner evidence:
{{learnerContext}}
Allowed source event ids: {{eventIds}}

Return JSON with a "proposals" array. A proposal is only a candidate; deterministic rules decide whether it is stored.`;

const inputSchema: z.ZodType<MemoryProposalsPromptInput> = z
  .object({
    context: scrubbedContextSchema,
    eventIds: z.array(z.uuid()).min(1).max(128),
  })
  .strict();

const outputSchema: z.ZodType<MemoryProposalsPromptOutput> = z
  .object({
    proposals: z
      .array(
        z
          .object({
            kind: z.string().trim().min(1).max(32),
            text: z.string().trim().min(1).max(500),
            confidence: z.number().min(0).max(1),
            temporary: z.boolean(),
            sourceEventId: z.uuid(),
            skillCode: z.string().trim().min(1).max(32).nullable(),
          })
          .strict(),
      )
      .max(16),
  })
  .strict();

export const memoryProposalsPrompt: PromptDefinition<'memory-proposals'> = {
  name: 'memory-proposals',
  version: '1.0.0',
  tier: 'TEACH',
  system:
    'Extract supported learner-memory candidates. Never infer traits or diagnoses. Return JSON only.',
  inputSchema,
  render: (input) =>
    renderPrompt(TEMPLATE, input.context, {
      learnerContext: JSON.stringify(input.context.value),
      eventIds: input.eventIds.join(', '),
    }),
  outputSchema,
  maxTokens: 800,
  jsonMode: true,
};
