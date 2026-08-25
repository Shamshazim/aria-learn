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
