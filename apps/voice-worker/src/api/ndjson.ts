/**
 * Reads newline-delimited JSON off a response body (P2H-07).
 *
 * A frame is only parsed once its newline has arrived, so a chunk that splits an object in half
 * — which is exactly what happens when the API writes a sentence the moment it is ready — does
 * not produce a truncated frame.
 */
export async function* readNdjson(body: ReadableStream<Uint8Array>): AsyncIterable<unknown> {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  let buffer = '';
  try {
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      buffer += decoder.decode(chunk.value, { stream: true });
      const complete = splitLines(buffer);
      buffer = complete.remainder;
      yield* complete.lines.map((line) => JSON.parse(line) as unknown);
    }
  } finally {
    reader.releaseLock();
  }
  const remainder = buffer.trim();
  if (remainder !== '') yield JSON.parse(remainder);
}

function splitLines(buffer: string): Readonly<{ lines: readonly string[]; remainder: string }> {
  const parts = buffer.split('\n');
  const remainder = parts.pop() ?? '';
  return { lines: parts.map((line) => line.trim()).filter((line) => line !== ''), remainder };
}

/**
 * P2H-07: gives up on a stream that has gone quiet.
 *
 * The ticket says "2× the segment gate budget", which is 60 ms — that is how long *gating* a
 * sentence may take, not how long the model may take to write the next one, and a child would
 * lose every answer at that bound. This is the gap that actually means the connection is gone:
 * generous enough for a slow tier, short enough that the turn ends while the child is still
 * waiting rather than after they have given up.
 */
export const STREAM_IDLE_TIMEOUT_MS = 10_000;

export class StreamWentQuietError extends Error {
  constructor(idleMs: number) {
    super(`A stream sent nothing for ${String(idleMs)} ms`);
    this.name = 'StreamWentQuietError';
  }
}

export async function* untilIdle<T>(frames: AsyncIterable<T>, idleMs: number): AsyncIterable<T> {
  const iterator = frames[Symbol.asyncIterator]();
  for (;;) {
    const next = await Promise.race([
      iterator.next(),
      new Promise<'idle'>((resolve) =>
        setTimeout(() => {
          resolve('idle');
        }, idleMs),
      ),
    ]);
    if (next === 'idle') {
      await iterator.return?.();
      throw new StreamWentQuietError(idleMs);
    }
    if (next.done === true) return;
    yield next.value;
  }
}
