/**
 * Anthropic Messages adapter (P0-12): `complete()` lives here, `stream()` in
 * `anthropic.stream.ts`, request building and error mapping in `anthropic.request.ts`, and the
 * response mapping in `anthropic.response.ts`. Wire types are in `anthropic.types.ts`.
 */
import {
  createRequestBody,
  extractJson,
  mapError,
  sendRequest,
  type AnthropicProviderOptions,
} from '@/ai/provider/adapters/anthropic.request';
import { createAnthropicLlmResponse } from '@/ai/provider/adapters/anthropic.response';
import { stream } from '@/ai/provider/adapters/anthropic.stream';
import {
  anthropicResponseSchema,
  type AnthropicResponse,
} from '@/ai/provider/adapters/anthropic.types';
import { createProviderHttpError } from '@/ai/provider/adapters/http-error';
import { createRequestTimeout } from '@/ai/provider/adapters/request-timeout';
import { readResponseText, responseByteLimit } from '@/ai/provider/adapters/sse';
import { AiError } from '@/ai/provider/errors';
import type { LlmProvider, LlmRequest, LlmResponse } from '@/ai/provider/types';

export type { AnthropicProviderOptions } from '@/ai/provider/adapters/anthropic.request';

/** Creates one adapter for an already validated Anthropic Messages endpoint. */
export function createAnthropicProvider(options: AnthropicProviderOptions): LlmProvider {
  return {
    complete: (request) => complete(options, request),
    stream: (request) => stream(options, request),
  };
}

async function complete(
  options: AnthropicProviderOptions,
  request: LlmRequest,
): Promise<LlmResponse> {
  const startedAt = options.now();
  const timeout = createRequestTimeout(
    request.timeoutMs ?? options.endpoint['timeout-seconds'] * 1_000,
    request.signal,
  );

  try {
    const body = createRequestBody(options.endpoint, request, 'complete');
    const response = await sendRequest(options, body, timeout.signal);
    if (!response.ok) throw createProviderHttpError(response, options.now());
    const parsed = await parseCompletionResponse(
      response,
      responseByteLimit(options.endpoint, request),
    );
    const text = parsed.content[0]?.text ?? '';
    return createAnthropicLlmResponse(options, {
      text: request.jsonMode === true ? extractJson(text) : text,
      tokensIn: parsed.usage.input_tokens,
      tokensOut: parsed.usage.output_tokens,
      finishReason: parsed.stop_reason,
      latencyMs: options.now() - startedAt,
    });
  } catch (error) {
    throw mapError(error, timeout.didExpire());
  } finally {
    timeout.dispose();
  }
}

async function parseCompletionResponse(
  response: Response,
  maxBytes: number,
): Promise<AnthropicResponse> {
  try {
    const input: unknown = JSON.parse(await readResponseText(response.body, maxBytes));
    const parsed = anthropicResponseSchema.safeParse(input);
    if (!parsed.success) throw new AiError('content');
    return parsed.data;
  } catch (error) {
    if (error instanceof AiError) throw error;
    throw new AiError('content');
  }
}
