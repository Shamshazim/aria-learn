/**
 * Reads server-sent events off a response body (P2H-07).
 *
 * Only the `data:` field is used — the turn stream has no event names or ids — and a frame is
 * parsed only once its blank line has arrived, so a chunk that splits a frame in half does not
 * produce half a sentence.
 */
export async function* readSse(body: ReadableStream<Uint8Array>): AsyncIterable<unknown> {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  let buffer = '';
  try {
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      buffer += decoder.decode(chunk.value, { stream: true });
      const split = splitFrames(buffer);
      buffer = split.remainder;
      yield* split.frames.map((frame) => JSON.parse(frame) as unknown);
    }
  } finally {
    reader.releaseLock();
  }
}

function splitFrames(buffer: string): Readonly<{ frames: readonly string[]; remainder: string }> {
  const parts = buffer.split('\n\n');
  const remainder = parts.pop() ?? '';
  return { frames: parts.flatMap(dataOf), remainder };
}

function dataOf(frame: string): readonly string[] {
  const data = frame
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trim())
    .join('');
  return data === '' ? [] : [data];
}
