/**
 * The streaming half of the Anthropic adapter: `content_block_delta` text becomes `text` chunks;
 * `message_start` carries input usage and `message_delta` output usage, so the `complete` chunk
 * is only final at stream end. In JSON mode deltas are withheld and the extracted object is
 * yielded once (same choice as the OpenAI-compatible prompt-only path; P0-19 note).
 */

import {
  createRequestBody,
  extractJson,
  mapError,
  sendRequest,
  type AnthropicProviderOptions,
} from '@/ai/provider/adapters/anthropic.request';
import { createAnthropicLlmResponse } from '@/ai/provider/adapters/anthropic.response';
import {
  anthropicMessageDeltaSchema,
  anthropicMessageStartSchema,
  anthropicStreamErrorSchema,
  anthropicOtherDeltaSchema,
  anthropicTextDeltaSchema,
  type AnthropicStreamEvent,
} from '@/ai/provider/adapters/anthropic.types';
import { createProviderHttpError } from '@/ai/provider/adapters/http-error';
import { completeStreamValues, type StreamAccumulator } from '@/ai/provider/adapters/llm-response';
import { createRequestTimeout } from '@/ai/provider/adapters/request-timeout';
import { readSseData, responseByteLimit } from '@/ai/provider/adapters/sse';
import { AiError } from '@/ai/provider/errors';
import type { LlmRequest, StreamChunk } from '@/ai/provider/types';

import type { z } from 'zod';

export async function* stream(
  options: AnthropicProviderOptions,
  request: LlmRequest,
): AsyncIterable<StreamChunk> {
  const startedAt = options.now();
  const timeout = createRequestTimeout(
    request.timeoutMs ?? options.endpoint['timeout-seconds'] * 1_000,
    request.signal,
  );
  let state: StreamAccumulator = {
    text: '',
    tokensIn: undefined,
    tokensOut: undefined,
    finishReason: null,
  };

  try {
    const body = createRequestBody(options.endpoint, request, 'stream');
    const response = await sendRequest(options, body, timeout.signal);
    if (!response.ok) throw createProviderHttpError(response, options.now());
    const maxBytes = responseByteLimit(options.endpoint, request);
    for await (const data of readSseData(response.body, maxBytes)) {
      const appended = appendStreamEvent(state, parseStreamEvent(data));
      state = appended.state;
      if (request.jsonMode !== true && appended.delta !== '') {
        yield { kind: 'text', text: appended.delta };
      }
    }
    const values = completeStreamValues(state, options.now() - startedAt);
    const text = request.jsonMode === true ? extractJson(values.text) : values.text;
    if (request.jsonMode === true) yield { kind: 'text', text };
    yield { kind: 'complete', response: createAnthropicLlmResponse(options, { ...values, text }) };
  } catch (error) {
    throw mapError(error, timeout.didExpire());
  } finally {
    timeout.dispose();
  }
}

/** An in-stream `error` event (`overloaded_error` included) is a retryable transport failure. */
function appendStreamEvent(
  state: StreamAccumulator,
  event: AnthropicStreamEvent | undefined,
): { state: StreamAccumulator; delta: string } {
  if (event === undefined) return { state, delta: '' };
  if (event.type === 'error') throw new AiError('transport');
  if (event.type === 'message_start') {
    return { state: { ...state, tokensIn: event.message.usage.input_tokens }, delta: '' };
  }
  if (event.type === 'message_delta') {
    return {
      state: {
        ...state,
        tokensOut: event.usage.output_tokens,
        finishReason: event.delta.stop_reason,
      },
      delta: '',
    };
  }
  return { state: { ...state, text: state.text + event.delta.text }, delta: event.delta.text };
}

/** Events the port does not need (`ping`, `content_block_start`, `message_stop`…) are skipped. */
function parseStreamEvent(data: string): AnthropicStreamEvent | undefined {
  let input: unknown;
  try {
    input = JSON.parse(data);
  } catch {
    throw new AiError('content');
  }
  const type = eventType(input);
  if (type === 'message_start') return parseKnownEvent(anthropicMessageStartSchema, input);
  if (type === 'content_block_delta') {
    const delta = parseKnownEvent(anthropicOtherDeltaSchema, input);
    if (delta.delta.type !== 'text_delta') return undefined;
    return parseKnownEvent(anthropicTextDeltaSchema, input);
  }
  if (type === 'message_delta') return parseKnownEvent(anthropicMessageDeltaSchema, input);
  if (type === 'error') return parseKnownEvent(anthropicStreamErrorSchema, input);
  return undefined;
}

function eventType(input: unknown): string | undefined {
  if (typeof input !== 'object' || input === null || !('type' in input)) return undefined;
  return typeof input.type === 'string' ? input.type : undefined;
}

function parseKnownEvent<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new AiError('content');
  return parsed.data;
}
