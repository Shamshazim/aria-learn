import { z } from 'zod';

import { bandSchema } from '@aria/shared';

import { renderRespondPrompt } from '@/ai/prompts/definitions/respond.template';
import { promptTextSchema, scrubbedContextSchema } from '@/ai/prompts/input.schema';
import { ARIA_PERSONA } from '@/ai/prompts/persona/aria.persona';
import type { PromptDefinition, RespondPromptInput, RespondPromptOutput } from '@/ai/prompts/types';

const CLOSING = 'Return JSON with one child-facing field named "text". Plain sentences only.';

const outputSchema: z.ZodType<RespondPromptOutput> = z
  .object({ text: z.string().trim().min(1).max(600) })
  .strict();

export const respondInputSchema: z.ZodType<RespondPromptInput> = z
  .object({
    context: scrubbedContextSchema,
    band: bandSchema,
    move: promptTextSchema,
    approach: promptTextSchema,
    subject: promptTextSchema,
    skill: promptTextSchema.optional(),
    lesson: z.string().max(4_000).optional(),
    question: promptTextSchema.optional(),
    learnerSaid: promptTextSchema.optional(),
    answerKey: promptTextSchema.optional(),
    correct: z.boolean().optional(),
  })
  .strict();

export const respondPrompt: PromptDefinition<'respond'> = {
  name: 'respond',
  version: '1.0.0',
  tier: 'TEACH',
  system: ARIA_PERSONA,
  inputSchema: respondInputSchema,
  render: (input) => renderRespondPrompt(input, CLOSING),
  outputSchema,
  maxTokens: 300,
  jsonMode: true,
};
