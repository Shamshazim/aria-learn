/** Bounded body readers for the OpenAI-compatible adapter: SSE framing and response size caps. */
import type { OpenAiCompatibleEndpoint } from '@/ai/provider/adapters/openai-compatible.types';
import { AiError } from '@/ai/provider/errors';
import type { LlmRequest } from '@/ai/provider/types';

const MAX_PROVIDER_RESPONSE_BYTES = 16 * 1_024 * 1_024;
const RESPONSE_OVERHEAD_BYTES = 64 * 1_024;
// A streamed token arrives inside a full SSE envelope (id, model, choices…): ~250 bytes on
// OpenAI, so budget generously; the 16 MB ceiling is the real guard.
const MAX_BYTES_PER_TOKEN = 512;

/** Reads data fields from an SSE response without assuming network chunk boundaries. */
export async function* readSseData(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): AsyncIterable<string> {
  const decoder = new TextDecoder();
  let buffer = '';

  for await (const value of boundedChunks(body, maxBytes)) {
    buffer += decoder.decode(value, { stream: true });
    const split = splitCompleteEvents(buffer);
    buffer = split.remainder;
    yield* dataFromEvents(split.events);
  }
  buffer += decoder.decode();
  yield* dataFromEvents(buffer.trim() === '' ? [] : [buffer]);
}

export async function readResponseText(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<string> {
  const decoder = new TextDecoder();
  let text = '';
  for await (const value of boundedChunks(body, maxBytes)) {
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

export function responseByteLimit(endpoint: OpenAiCompatibleEndpoint, request: LlmRequest): number {
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

async function* boundedChunks(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): AsyncIterable<Uint8Array> {
  if (body === null) throw new AiError('content');
  let bytes = 0;
  for await (const value of body) {
    bytes += value.byteLength;
    if (bytes > maxBytes) throw new AiError('content');
    yield value;
  }
}

function splitCompleteEvents(buffer: string): { events: string[]; remainder: string } {
  const normalized = buffer.replaceAll('\r\n', '\n');
  const parts = normalized.split('\n\n');
  return { events: parts.slice(0, -1), remainder: parts.at(-1) ?? '' };
}

function eventData(event: string): string | undefined {
  const lines = event
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart());
  return lines.length === 0 ? undefined : lines.join('\n');
}

function* dataFromEvents(events: string[]): Iterable<string> {
  for (const event of events) {
    const data = eventData(event);
    if (data !== undefined) yield data;
  }
}
