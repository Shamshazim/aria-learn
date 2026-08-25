/** Bounded wire types and response schemas for Anthropic's Messages API. */
import { z } from 'zod';

import type { AiConfig } from '@/ai/provider/config.schema';

const MAX_RESPONSE_TEXT_CHARS = 16 * 1_024 * 1_024;
const MAX_TOKEN_COUNT = 10_000_000;

type ConfiguredEndpoint = NonNullable<AiConfig['app']['ai']['endpoints'][string]>;

export type AnthropicEndpoint = Omit<ConfiguredEndpoint, 'api' | 'api-key'> & {
  api: 'anthropic';
  'api-key': string;
};

export type AnthropicRequest = {
  model: string;
  system: string;
  messages: [{ role: 'user'; content: string }];
  max_tokens: number;
  temperature?: number;
  stream?: true;
};

const usageSchema = z.object({
  input_tokens: z.number().int().nonnegative().max(MAX_TOKEN_COUNT),
  output_tokens: z.number().int().nonnegative().max(MAX_TOKEN_COUNT),
});

const outputUsageSchema = z.object({
  output_tokens: z.number().int().nonnegative().max(MAX_TOKEN_COUNT),
});

export const anthropicResponseSchema = z.object({
  content: z
    .array(z.object({ type: z.literal('text'), text: z.string().max(MAX_RESPONSE_TEXT_CHARS) }))
    .min(1)
    .max(64),
  stop_reason: z.string().max(64).nullable(),
  usage: usageSchema,
});

export type AnthropicResponse = z.infer<typeof anthropicResponseSchema>;

export const anthropicMessageStartSchema = z.object({
  type: z.literal('message_start'),
  message: z.object({ usage: usageSchema }),
});

export const anthropicTextDeltaSchema = z.object({
  type: z.literal('content_block_delta'),
  delta: z.object({ type: z.literal('text_delta'), text: z.string().max(MAX_RESPONSE_TEXT_CHARS) }),
});

export const anthropicMessageDeltaSchema = z.object({
  type: z.literal('message_delta'),
  delta: z.object({ stop_reason: z.string().max(64).nullable() }),
  usage: outputUsageSchema,
});

export const anthropicStreamErrorSchema = z.object({
  type: z.literal('error'),
  error: z.object({ type: z.string().max(64) }),
});

export type AnthropicStreamEvent =
  | z.infer<typeof anthropicMessageStartSchema>
  | z.infer<typeof anthropicTextDeltaSchema>
  | z.infer<typeof anthropicMessageDeltaSchema>
  | z.infer<typeof anthropicStreamErrorSchema>;
