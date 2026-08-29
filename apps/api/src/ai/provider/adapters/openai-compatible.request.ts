/**
 * Builds and sends chat-completions requests for the OpenAI-compatible adapter, including the
 * `response_format` fallback (P0-11 trap 2) and the error mapping both `complete()` and
 * `stream()` share. Nothing here logs: the key, the prompt and vendor bodies stay in memory.
 */
import { createProviderHttpError } from '@/ai/provider/adapters/http-error';
import { extractJsonObject } from '@/ai/provider/adapters/json-extract';
import type {
  OpenAiChatRequest,
  OpenAiCompatibleEndpoint,
} from '@/ai/provider/adapters/openai-compatible.types';
import { readResponseText } from '@/ai/provider/adapters/sse';
import { AiError } from '@/ai/provider/errors';
import type { LlmRequest } from '@/ai/provider/types';

const MAX_ERROR_RESPONSE_BYTES = 16 * 1_024;

export type OpenAiCompatibleProviderOptions = {
  endpointName: string;
  endpoint: OpenAiCompatibleEndpoint;
  fetch: typeof globalThis.fetch;
  now: () => number;
};

/** How JSON is requested and how the answer is delivered; named so call sites read. */
export type RequestShape = {
  jsonVia: 'response-format' | 'prompt-only';
  delivery: 'complete' | 'stream';
};

function createRequestBody(
  endpoint: OpenAiCompatibleEndpoint,
  request: LlmRequest,
  shape: RequestShape,
): OpenAiChatRequest {
  const promptOnlyJson = shape.jsonVia === 'prompt-only';
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
  if (shape.delivery === 'stream') {
    body.stream = true;
    body.stream_options = { include_usage: true };
  }
  return body;
}

export async function requestCompletion(
  options: OpenAiCompatibleProviderOptions,
  request: LlmRequest,
  signal: AbortSignal,
  delivery: RequestShape['delivery'],
): Promise<{ response: Response; extractJson: boolean }> {
  if (request.jsonMode === true && options.endpoint['json-via'] === 'prompt') {
    const byPrompt = await sendRequest(
      options,
      createRequestBody(options.endpoint, request, { jsonVia: 'prompt-only', delivery }),
      signal,
    );
    if (!byPrompt.ok) throw createProviderHttpError(byPrompt, options.now());
    return { response: byPrompt, extractJson: true };
  }
  const response = await sendRequest(
    options,
    createRequestBody(options.endpoint, request, { jsonVia: 'response-format', delivery }),
    signal,
  );
  if (request.jsonMode === true && (await isResponseFormatRejection(response))) {
    const fallback = await sendRequest(
      options,
      createRequestBody(options.endpoint, request, { jsonVia: 'prompt-only', delivery }),
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

export function extractJson(text: string): string {
  try {
    return extractJsonObject(text);
  } catch {
    throw new AiError('content');
  }
}

function chatCompletionsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, '')}/chat/completions`;
}

/**
 * A caller-side abort (`request.signal`) also lands here as `transport`; the port has no cancel
 * category, and P0-13 decides whether an aborted call is retried.
 */
export function mapError(error: unknown, timedOut: boolean): AiError {
  if (timedOut) return new AiError('timeout');
  if (error instanceof AiError) return error;
  return new AiError('transport');
}
