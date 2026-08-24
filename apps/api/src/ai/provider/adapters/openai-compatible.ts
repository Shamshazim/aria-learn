import { createProviderHttpError } from '@/ai/provider/adapters/http-error';
import { extractJsonObject } from '@/ai/provider/adapters/json-extract';
import { createOpenAiLlmResponse } from '@/ai/provider/adapters/openai-compatible.response';
import {
  readResponseText,
  readSseData,
  responseByteLimit,
} from '@/ai/provider/adapters/openai-compatible.sse';
import {
  openAiChatResponseSchema,
  openAiStreamResponseSchema,
} from '@/ai/provider/adapters/openai-compatible.types';
import type {
  OpenAiChatRequest,
  OpenAiChatResponse,
  OpenAiCompatibleEndpoint,
  OpenAiStreamResponse,
  ResponseValues,
  StreamAccumulator,
} from '@/ai/provider/adapters/openai-compatible.types';
import { createRequestTimeout } from '@/ai/provider/adapters/request-timeout';
import { AiError } from '@/ai/provider/errors';
import type { LlmProvider, LlmRequest, LlmResponse, StreamChunk } from '@/ai/provider/types';

const MAX_ERROR_RESPONSE_BYTES = 16 * 1_024;

export type OpenAiCompatibleProviderOptions = {
  endpointName: string;
  endpoint: OpenAiCompatibleEndpoint;
  fetch: typeof globalThis.fetch;
  now: () => number;
};

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
    const result = await requestCompletion(options, request, timeout.signal);
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

function createRequestBody(
  endpoint: OpenAiCompatibleEndpoint,
  request: LlmRequest,
  promptOnlyJson = false,
  streaming = false,
): OpenAiChatRequest {
  const system =
    request.jsonMode === true && promptOnlyJson
      ? `${request.system}\n\nReturn exactly one JSON object and no other text.`
      : request.system;
  const body: OpenAiChatRequest = {
    model: endpoint.model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: request.user },
    ],
  };
  const maxTokens = request.maxTokens ?? endpoint['max-tokens'];
  if (endpoint.reasoning === true) body.max_completion_tokens = maxTokens;
  else {
    body.max_tokens = maxTokens;
    body.temperature = request.temperature ?? 0;
  }
  if (request.jsonMode === true && !promptOnlyJson) {
    body.response_format = { type: 'json_object' };
  }
  if (streaming) {
    body.stream = true;
    body.stream_options = { include_usage: true };
  }
  return body;
}

async function requestCompletion(
  options: OpenAiCompatibleProviderOptions,
  request: LlmRequest,
  signal: AbortSignal,
  streaming = false,
): Promise<{ response: Response; extractJson: boolean }> {
  const response = await sendRequest(
    options,
    createRequestBody(options.endpoint, request, false, streaming),
    signal,
  );
  if (request.jsonMode === true && (await isResponseFormatRejection(response))) {
    const fallback = await sendRequest(
      options,
      createRequestBody(options.endpoint, request, true, streaming),
      signal,
    );
    if (!fallback.ok) throw createProviderHttpError(fallback, options.now());
    return { response: fallback, extractJson: true };
  }
  if (!response.ok) throw createProviderHttpError(response, options.now());
  return { response, extractJson: false };
}

async function sendRequest(
  options: OpenAiCompatibleProviderOptions,
  body: OpenAiChatRequest,
  signal: AbortSignal,
): Promise<Response> {
  return options.fetch(chatCompletionsUrl(options.endpoint['base-url']), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${options.endpoint['api-key']}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  });
}

async function isResponseFormatRejection(response: Response): Promise<boolean> {
  if (response.status !== 400 && response.status !== 422) return false;
  try {
    const body = (await readResponseText(response.body, MAX_ERROR_RESPONSE_BYTES)).toLowerCase();
    const namesFormat = /response[_ ]format|json_object/.test(body);
    const rejectsFormat = /unsupported|not supported|unknown|unrecognized|invalid/.test(body);
    return namesFormat && rejectsFormat;
  } catch {
    return false;
  }
}

function extractJson(text: string): string {
  try {
    return extractJsonObject(text);
  } catch {
    throw new AiError('content');
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

function chatCompletionsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, '')}/chat/completions`;
}

function mapError(error: unknown, timedOut: boolean): AiError {
  if (timedOut) return new AiError('timeout');
  if (error instanceof AiError) return error;
  return new AiError('transport');
}

async function* stream(
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
    const result = await requestCompletion(options, request, timeout.signal, true);
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
  const delta = choice?.delta.content ?? '';
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

function completeStreamValues(state: StreamAccumulator, latencyMs: number): ResponseValues {
  if (state.tokensIn === undefined || state.tokensOut === undefined) throw new AiError('content');
  return { ...state, tokensIn: state.tokensIn, tokensOut: state.tokensOut, latencyMs };
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
