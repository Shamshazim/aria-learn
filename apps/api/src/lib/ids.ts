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

/**
 * Deterministic UUIDs for tests.
 *
 * `sequentialIds` produces `id-1`, which a UUID column rejects, so anything writing a primary
 * key needs this instead. The shape is a valid v4 UUID with a counter in the last field, so a
 * failing assertion still tells you which row it was.
 */
export function sequentialUuids(): IdGenerator {
  let n = 0;
  return {
    next: () => {
      n += 1;
      return `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
    },
  };
}
