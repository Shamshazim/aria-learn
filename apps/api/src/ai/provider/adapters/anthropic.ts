/** Anthropic Messages adapter: complete and streamed responses become the shared LLM port. */
import {
  anthropicMessageDeltaSchema,
  anthropicMessageStartSchema,
  anthropicResponseSchema,
  anthropicStreamErrorSchema,
  anthropicTextDeltaSchema,
  type AnthropicEndpoint,
  type AnthropicRequest,
  type AnthropicResponse,
  type AnthropicResponseValues,
  type AnthropicStreamEvent,
  type AnthropicStreamState,
} from '@/ai/provider/adapters/anthropic.types';
import { createProviderHttpError } from '@/ai/provider/adapters/http-error';
import { extractJsonObject } from '@/ai/provider/adapters/json-extract';
import { readResponseText, readSseData } from '@/ai/provider/adapters/openai-compatible.sse';
import { createRequestTimeout } from '@/ai/provider/adapters/request-timeout';
import { AiError } from '@/ai/provider/errors';
import type { LlmProvider, LlmRequest, LlmResponse, StreamChunk } from '@/ai/provider/types';

const MAX_PROVIDER_RESPONSE_BYTES = 16 * 1_024 * 1_024;
const RESPONSE_OVERHEAD_BYTES = 64 * 1_024;
// Streaming wraps small deltas in full SSE events; the 16 MB ceiling remains the hard cap.
const MAX_BYTES_PER_TOKEN = 512;

export type AnthropicProviderOptions = {
  endpointName: string;
  endpoint: AnthropicEndpoint;
  fetch: typeof globalThis.fetch;
  now: () => number;
};

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
    const response = await sendRequest(
      options,
      createRequestBody(options.endpoint, request),
      timeout.signal,
    );
    if (!response.ok) throw createProviderHttpError(response, options.now());
    const body = await parseCompletionResponse(
      response,
      responseByteLimit(options.endpoint, request),
    );
    const result = createLlmResponse(options, {
      text: body.content[0]?.text ?? '',
      tokensIn: body.usage.input_tokens,
      tokensOut: body.usage.output_tokens,
      finishReason: body.stop_reason,
      latencyMs: options.now() - startedAt,
    });
    return request.jsonMode === true ? { ...result, text: extractJson(result.text) } : result;
  } catch (error) {
    throw mapError(error, timeout.didExpire());
  } finally {
    timeout.dispose();
  }
}

function createRequestBody(endpoint: AnthropicEndpoint, request: LlmRequest): AnthropicRequest {
  // Claude 4.6+ rejects assistant prefill, and this port has no schema for structured outputs.
  return {
    model: endpoint.model,
    system:
      request.jsonMode === true
        ? `${request.system}\n\nReturn exactly one JSON object and no other text.`
        : request.system,
    messages: [{ role: 'user', content: request.user }],
    max_tokens: request.maxTokens ?? endpoint['max-tokens'],
    ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
  };
}

function extractJson(text: string): string {
  try {
    return extractJsonObject(text);
  } catch {
    throw new AiError('content');
  }
}

async function sendRequest(
  options: AnthropicProviderOptions,
  body: AnthropicRequest,
  signal: AbortSignal,
): Promise<Response> {
  return options.fetch(messagesUrl(options.endpoint['base-url']), {
    method: 'POST',
    headers: {
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'x-api-key': options.endpoint['api-key'],
    },
    body: JSON.stringify(body),
    signal,
  });
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

function createLlmResponse(
  options: AnthropicProviderOptions,
  values: AnthropicResponseValues,
): LlmResponse {
  if (values.text === '') throw new AiError('content');
  return {
    text: values.text,
    endpointName: options.endpointName,
    model: options.endpoint.model,
    tokensIn: values.tokensIn,
    tokensOut: values.tokensOut,
    costUsd:
      (values.tokensIn * options.endpoint['cost-per-mtok-in'] +
        values.tokensOut * options.endpoint['cost-per-mtok-out']) /
      1_000_000,
    latencyMs: values.latencyMs,
    finishReason: mapFinishReason(values.finishReason),
  };
}

function mapFinishReason(reason: string | null): LlmResponse['finishReason'] {
  if (reason === 'end_turn' || reason === 'stop_sequence') return 'stop';
  if (reason === 'max_tokens' || reason === 'model_context_window_exceeded') return 'length';
  if (reason === 'refusal') return 'filtered';
  return 'error';
}

function responseByteLimit(endpoint: AnthropicEndpoint, request: LlmRequest): number {
  const requested = request.maxTokens;
  const maxTokens =
    requested !== undefined && Number.isFinite(requested) && requested > 0
      ? requested
      : endpoint['max-tokens'];
  return Math.min(
    MAX_PROVIDER_RESPONSE_BYTES,
    RESPONSE_OVERHEAD_BYTES + Math.ceil(maxTokens) * MAX_BYTES_PER_TOKEN,
  );
}

function messagesUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, '')}/v1/messages`;
}

function mapError(error: unknown, timedOut: boolean): AiError {
  if (timedOut) return new AiError('timeout');
  if (error instanceof AiError) return error;
  return new AiError('transport');
}

async function* stream(
  options: AnthropicProviderOptions,
  request: LlmRequest,
): AsyncIterable<StreamChunk> {
  const startedAt = options.now();
  const timeout = createRequestTimeout(
    request.timeoutMs ?? options.endpoint['timeout-seconds'] * 1_000,
    request.signal,
  );
  let state: AnthropicStreamState = {
    text: '',
    tokensIn: undefined,
    tokensOut: undefined,
    finishReason: null,
  };

  try {
    const body: AnthropicRequest = {
      ...createRequestBody(options.endpoint, request),
      stream: true,
    };
    const response = await sendRequest(options, body, timeout.signal);
    if (!response.ok) throw createProviderHttpError(response, options.now());
    for await (const data of readSseData(
      response.body,
      responseByteLimit(options.endpoint, request),
    )) {
      const appended = appendStreamEvent(state, parseStreamEvent(data));
      state = appended.state;
      if (request.jsonMode !== true && appended.delta !== '') {
        yield { kind: 'text', text: appended.delta };
      }
    }
    const values = completeStreamValues(state, options.now() - startedAt);
    const responseText = request.jsonMode === true ? extractJson(values.text) : values.text;
    if (request.jsonMode === true) yield { kind: 'text', text: responseText };
    yield {
      kind: 'complete',
      response: createLlmResponse(options, { ...values, text: responseText }),
    };
  } catch (error) {
    throw mapError(error, timeout.didExpire());
  } finally {
    timeout.dispose();
  }
}

function appendStreamEvent(
  state: AnthropicStreamState,
  event: AnthropicStreamEvent | undefined,
): { state: AnthropicStreamState; delta: string } {
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

function completeStreamValues(
  state: AnthropicStreamState,
  latencyMs: number,
): AnthropicResponseValues {
  if (state.tokensIn === undefined || state.tokensOut === undefined) throw new AiError('content');
  return { ...state, tokensIn: state.tokensIn, tokensOut: state.tokensOut, latencyMs };
}

function parseStreamEvent(data: string): AnthropicStreamEvent | undefined {
  let input: unknown;
  try {
    input = JSON.parse(data);
  } catch {
    throw new AiError('content');
  }
  const type = eventType(input);
  if (type === 'message_start') return parseKnownEvent(anthropicMessageStartSchema, input);
  if (type === 'content_block_delta') return parseKnownEvent(anthropicTextDeltaSchema, input);
  if (type === 'message_delta') return parseKnownEvent(anthropicMessageDeltaSchema, input);
  if (type === 'error') return parseKnownEvent(anthropicStreamErrorSchema, input);
  return undefined;
}

function eventType(input: unknown): string | undefined {
  if (typeof input !== 'object' || input === null || !('type' in input)) return undefined;
  return typeof input.type === 'string' ? input.type : undefined;
}

function parseKnownEvent<T>(
  schema: { safeParse: (input: unknown) => { success: true; data: T } | { success: false } },
  input: unknown,
): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new AiError('content');
  return parsed.data;
}
