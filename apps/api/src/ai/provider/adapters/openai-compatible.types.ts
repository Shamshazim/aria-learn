/**
 * Wire types for the OpenAI chat-completions format: the request we send and the zod schemas
 * that bound what we accept back (§8 — a hostile or broken vendor stays allocation-safe).
 * Schemas sit beside these types because they *are* the wire type; nothing else imports them.
 */
import { z } from 'zod';

import type { AiConfig } from '@/ai/provider/config.schema';

const MAX_RESPONSE_TEXT_CHARS = 16 * 1_024 * 1_024;
const MAX_TOKEN_COUNT = 10_000_000;

type ConfiguredEndpoint = NonNullable<AiConfig['app']['ai']['endpoints'][string]>;

export type OpenAiCompatibleEndpoint = Omit<ConfiguredEndpoint, 'api' | 'api-key'> & {
  api: 'openai';
  'api-key': string;
};

export type OpenAiChatRequest = {
  model: string;
  messages: [{ role: 'system'; content: string }, { role: 'user'; content: string }];
  temperature?: number;
  max_tokens?: number;
  max_completion_tokens?: number;
  response_format?: { type: 'json_object' };
  reasoning_effort?: 'low' | 'medium' | 'high';
  stream?: boolean;
  stream_options?: { include_usage: true };
};

const usageSchema = z.object({
  prompt_tokens: z.number().int().nonnegative().max(MAX_TOKEN_COUNT),
  completion_tokens: z.number().int().nonnegative().max(MAX_TOKEN_COUNT),
});

export const openAiChatResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().max(MAX_RESPONSE_TEXT_CHARS) }),
        finish_reason: z.string().max(64).nullable(),
      }),
    )
    .length(1),
  usage: usageSchema,
});

export type OpenAiChatResponse = z.infer<typeof openAiChatResponseSchema>;

export const openAiStreamResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        // Compatible vendors omit `delta` on the finish chunk and `finish_reason` on delta chunks.
        delta: z
          .object({ content: z.string().max(MAX_RESPONSE_TEXT_CHARS).nullable().optional() })
          .optional(),
        finish_reason: z.string().max(64).nullable().optional(),
      }),
    )
    .max(1),
  usage: usageSchema.nullable().optional(),
});

export type OpenAiStreamResponse = z.infer<typeof openAiStreamResponseSchema>;
