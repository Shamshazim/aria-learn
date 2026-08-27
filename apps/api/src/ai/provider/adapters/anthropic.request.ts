/**
 * Builds and sends Messages API requests for the Anthropic adapter and holds the error mapping
 * `complete()` and `stream()` share. Nothing here logs: the key, the prompt and vendor bodies
 * stay in memory (cloud-model-layer §5.3).
 */
import type { AnthropicEndpoint, AnthropicRequest } from '@/ai/provider/adapters/anthropic.types';
import { extractJsonObject } from '@/ai/provider/adapters/json-extract';
import { AiError } from '@/ai/provider/errors';
import type { LlmRequest } from '@/ai/provider/types';

export type AnthropicProviderOptions = {
  endpointName: string;
  endpoint: AnthropicEndpoint;
  fetch: typeof globalThis.fetch;
  now: () => number;
};

/** How the answer is delivered; named so call sites read (CODE-STANDARDS §1). */
export type Delivery = 'complete' | 'stream';

/**
 * JSON is requested by instruction, not by assistant prefill: Claude 4.6+ rejects prefill and
 * this port has no schema for structured outputs, so the object is extracted from the reply
 * (P0-12 design note; the ticket was amended to match).
 */
export function createRequestBody(
  endpoint: AnthropicEndpoint,
  request: LlmRequest,
  delivery: Delivery,
): AnthropicRequest {
  return {
    model: endpoint.model,
    system:
      request.jsonMode === true
        ? `${request.system}\n\nReturn exactly one JSON object and no other text.`
        : request.system,
    messages: [{ role: 'user', content: request.user }],
    max_tokens: request.maxTokens ?? endpoint['max-tokens'],
    ...(request.temperature === undefined || endpoint['supports-temperature'] === false
      ? {}
      : { temperature: request.temperature }),
    ...(delivery === 'stream' ? { stream: true as const } : {}),
  };
}

export async function sendRequest(
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

export function extractJson(text: string): string {
  try {
    return extractJsonObject(text);
  } catch {
    throw new AiError('content');
  }
}

function messagesUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, '')}/v1/messages`;
}

/**
 * An expired deadline is `timeout`; anything not already categorised (including a caller's own
 * abort) is `transport`, which P0-13 treats as retryable.
 */
export function mapError(error: unknown, timedOut: boolean): AiError {
  if (timedOut) return new AiError('timeout');
  if (error instanceof AiError) return error;
  return new AiError('transport');
}
