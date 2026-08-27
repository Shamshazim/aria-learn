import { randomBytes } from 'node:crypto';

/**
 * Randomness as a dependency, for the same reason as the clock and the id generator: a
 * secret a test can predict is a test that can assert on what was stored (CODE-STANDARDS §4).
 *
 * 32 bytes, base64url. Long enough that guessing is not a strategy, short enough to sit in a
 * cookie beside its session id.
 */
const TOKEN_BYTES = 32;

export type TokenGenerator = {
  next(): string;
};

export const randomTokens: TokenGenerator = {
  next: () => randomBytes(TOKEN_BYTES).toString('base64url'),
};

/** Predictable secrets for tests: `secret-1`, `secret-2`, … Never used in production. */
export function sequentialTokens(prefix = 'secret'): TokenGenerator {
  let n = 0;
  return {
    next: () => {
      n += 1;
      return `${prefix}-${String(n)}`;
    },
  };
}
