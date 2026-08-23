import { randomUUID } from 'node:crypto';

/**
 * Identifier generation as a dependency, for the same reason as the clock: a request id that
 * a test can predict is a test that can assert on it.
 */
export type IdGenerator = {
  next(): string;
};

export const uuidGenerator: IdGenerator = {
  next: () => randomUUID(),
};

/** Deterministic ids for tests: `prefix-1`, `prefix-2`, … */
export function sequentialIds(prefix = 'id'): IdGenerator {
  let n = 0;
  return {
    next: () => {
      n += 1;
      return `${prefix}-${String(n)}`;
    },
  };
}
