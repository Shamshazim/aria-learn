/**
 * The streaming half of the OpenAI-compatible adapter: SSE deltas become `text` chunks and the
 * usage record (requested via `stream_options`) closes with one `complete` chunk. On the
 * prompt-only JSON path deltas are withheld and the extracted object is yielded once at the end.
 */
import { completeStreamValues, type StreamAccumulator } from '@/ai/provider/adapters/llm-response';
import {
  extractJson,
  mapError,
  requestCompletion,
  type OpenAiCompatibleProviderOptions,
} from '@/ai/provider/adapters/openai-compatible.request';
import { createOpenAiLlmResponse } from '@/ai/provider/adapters/openai-compatible.response';
import {
  openAiStreamResponseSchema,
  type OpenAiStreamResponse,
} from '@/ai/provider/adapters/openai-compatible.types';
import { createRequestTimeout } from '@/ai/provider/adapters/request-timeout';
import { readSseData, responseByteLimit } from '@/ai/provider/adapters/sse';
import { AiError } from '@/ai/provider/errors';
import type { LlmRequest, StreamChunk } from '@/ai/provider/types';

export async function* stream(
  options: OpenAiCompatibleProviderOptions,
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
    const result = await requestCompletion(options, request, timeout.signal, 'stream');
    const maxBytes = responseByteLimit(options.endpoint, request);
    for await (const data of readSseData(result.response.body, maxBytes)) {
      if (data === '[DONE]') continue;
      const appended = appendStreamResponse(state, parseStreamResponse(data));
      state = appended.state;
      if (!result.extractJson && appended.delta !== '') {
        yield { kind: 'text', text: appended.delta };
      }
    }
    const values = completeStreamValues(state, options.now() - startedAt);
    const responseText = result.extractJson ? extractJson(values.text) : values.text;
    if (result.extractJson) yield { kind: 'text', text: responseText };
    yield {
      kind: 'complete',
      response: createOpenAiLlmResponse(options.endpointName, options.endpoint, {
        ...values,
        text: responseText,
      }),
    };
  } catch (error) {
    throw mapError(error, timeout.didExpire());
  } finally {
    timeout.dispose();
  }
}

function appendStreamResponse(
  state: StreamAccumulator,
  chunk: OpenAiStreamResponse,
): { state: StreamAccumulator; delta: string } {
  const choice = chunk.choices[0];
  const delta = choice?.delta?.content ?? '';
  return {
    delta,
    state: {
      text: state.text + delta,
      tokensIn: chunk.usage?.prompt_tokens ?? state.tokensIn,
      tokensOut: chunk.usage?.completion_tokens ?? state.tokensOut,
      finishReason: choice?.finish_reason ?? state.finishReason,
    },
  };
}

function parseStreamResponse(data: string): OpenAiStreamResponse {
  try {
    const input: unknown = JSON.parse(data);
    const parsed = openAiStreamResponseSchema.safeParse(input);
    if (!parsed.success) throw new AiError('content');
    return parsed.data;
  } catch (error) {
    if (error instanceof AiError) throw error;
    throw new AiError('content');
  }
}
