import { describe, expect, it } from 'vitest';

import { readNdjson, StreamWentQuietError, untilIdle } from '@/api/ndjson';

function body(chunks: readonly string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function collect<T>(values: AsyncIterable<T>): Promise<readonly T[]> {
  const result: T[] = [];
  for await (const value of values) result.push(value);
  return result;
}

describe('reading a turn off the wire', () => {
  it('waits for the newline before it trusts a frame', async () => {
    const frames = await collect(readNdjson(body(['{"a":1}\n{"b', '":2}\n'])));

    expect(frames).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('reads a last frame that arrived without its newline', async () => {
    expect(await collect(readNdjson(body(['{"a":1}'])))).toEqual([{ a: 1 }]);
  });

  it('gives up on a stream that has gone quiet, rather than leaving a child waiting', async () => {
    const silent = (async function* () {
      yield await Promise.resolve('first');
      await new Promise((resolve) => setTimeout(resolve, 200));
      yield 'never heard';
    })();

    await expect(collect(untilIdle(silent, 20))).rejects.toBeInstanceOf(StreamWentQuietError);
  });

  it('does not time out a stream that keeps sending', async () => {
    const talkative = (async function* () {
      for (const value of ['one', 'two', 'three']) {
        await new Promise((resolve) => setTimeout(resolve, 5));
        yield value;
      }
    })();

    await expect(collect(untilIdle(talkative, 50))).resolves.toEqual(['one', 'two', 'three']);
  });
});
