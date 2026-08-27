import { z } from 'zod';

import { respondInputSchema } from '@/ai/prompts/definitions/respond.prompt';
import { renderRespondPrompt } from '@/ai/prompts/definitions/respond.template';
import { ARIA_PERSONA } from '@/ai/prompts/persona/aria.persona';
import type { PromptDefinition, RespondStreamPromptOutput } from '@/ai/prompts/types';

/**
 * P2H-07: the same answer as `respond`, written so it can be spoken before it is finished.
 *
 * The only difference is the closing line. A JSON envelope has to be complete before anything
 * inside it can be trusted, so a streamed sentence would be a fragment of a string literal
 * rather than a sentence. Plain prose can be cut at a full stop and gated on its own.
 */
const CLOSING = 'Answer in plain sentences. No JSON, no lists, no headings.';

/** Streamed, never `run()`: the gate reads sentences off the wire, not a parsed object. */
const outputSchema: z.ZodType<RespondStreamPromptOutput> = z
  .object({ text: z.string().trim().min(1).max(600) })
  .strict();

export const respondStreamPrompt: PromptDefinition<'respond-stream'> = {
  name: 'respond-stream',
  version: '1.0.0',
  tier: 'TEACH',
  system: ARIA_PERSONA,
  inputSchema: respondInputSchema,
  render: (input) => renderRespondPrompt(input, CLOSING),
  outputSchema,
  maxTokens: 300,
  jsonMode: false,
};
