/**
 * One turn at a time, in the order they were asked for.
 *
 * A transcript, a silence rung and a replay can all be requested while another turn is still
 * streaming; each waits for the one before it to finish, so the child never hears two answers
 * interleaved and the API never sees an event out of order.
 */
export function createStreamSerializer(): (
  stream: () => AsyncIterable<string>,
) => AsyncIterable<string> {
  let tail = Promise.resolve();
  return (stream) => ({
    async *[Symbol.asyncIterator]() {
      const previous = tail;
      let release = (): void => undefined;
      tail = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        yield* stream();
      } finally {
        release();
      }
    },
  });
}
