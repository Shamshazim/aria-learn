/**
 * `LlmProvider` for one OpenAI-compatible endpoint (P0-11). `complete()` lives here; request
 * building and the JSON fallback are in `.request.ts`, streaming in `.stream.ts`.
 */
import {
  extractJson,
  mapError,
  requestCompletion,
  type OpenAiCompatibleProviderOptions,
} from '@/ai/provider/adapters/openai-compatible.request';
import { createOpenAiLlmResponse } from '@/ai/provider/adapters/openai-compatible.response';
import { stream } from '@/ai/provider/adapters/openai-compatible.stream';
import { openAiChatResponseSchema } from '@/ai/provider/adapters/openai-compatible.types';
import type { OpenAiChatResponse } from '@/ai/provider/adapters/openai-compatible.types';
import { createRequestTimeout } from '@/ai/provider/adapters/request-timeout';
import { readResponseText, responseByteLimit } from '@/ai/provider/adapters/sse';
import { AiError } from '@/ai/provider/errors';
import type { LlmProvider, LlmRequest, LlmResponse } from '@/ai/provider/types';

export type { OpenAiCompatibleProviderOptions } from '@/ai/provider/adapters/openai-compatible.request';

/** Creates one adapter for an already validated OpenAI-compatible endpoint. */
export function createOpenAiCompatibleProvider(
  options: OpenAiCompatibleProviderOptions,
): LlmProvider {
  return {
    complete: (request) => complete(options, request),
    stream: (request) => stream(options, request),
  };
}

async function complete(
  options: OpenAiCompatibleProviderOptions,
  request: LlmRequest,
): Promise<LlmResponse> {
  const startedAt = options.now();
  const timeout = createRequestTimeout(
    request.timeoutMs ?? options.endpoint['timeout-seconds'] * 1_000,
    request.signal,
  );

  try {
    const result = await requestCompletion(options, request, timeout.signal, 'complete');
    const body = await parseCompletionResponse(
      result.response,
      responseByteLimit(options.endpoint, request),
    );
    const llmResponse = toLlmResponse(options, body, options.now() - startedAt);
    return result.extractJson
      ? { ...llmResponse, text: extractJson(llmResponse.text) }
      : llmResponse;
  } catch (error) {
    throw mapError(error, timeout.didExpire());
  } finally {
    timeout.dispose();
  }
}

async function parseCompletionResponse(
  response: Response,
  maxBytes: number,
): Promise<OpenAiChatResponse> {
  try {
    const input: unknown = JSON.parse(await readResponseText(response.body, maxBytes));
    const parsed = openAiChatResponseSchema.safeParse(input);
    if (!parsed.success) throw new AiError('content');
    return parsed.data;
  } catch (error) {
    if (error instanceof AiError) throw error;
    throw new AiError('content');
  }
}

function toLlmResponse(
  options: OpenAiCompatibleProviderOptions,
  body: OpenAiChatResponse,
  latencyMs: number,
): LlmResponse {
  const choice = body.choices[0];
  if (choice === undefined) throw new AiError('content');
  return createOpenAiLlmResponse(options.endpointName, options.endpoint, {
    text: choice.message.content,
    tokensIn: body.usage.prompt_tokens,
    tokensOut: body.usage.completion_tokens,
    latencyMs,
    finishReason: choice.finish_reason,
  });
}
