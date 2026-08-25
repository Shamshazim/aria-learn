import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Opaque bearer secrets — device grants and child session tokens — and how they are stored.
 *
 * These are 256-bit random strings, not passwords. A slow KDF buys nothing against a value
 * that cannot be guessed and would cost a round trip on every child request, so the stored
 * form is a plain SHA-256 digest. The short, guessable credential in this system is the
 * child's four-picture secret, and it is handled quite differently in `picture-secret.ts`.
 *
 * The plaintext exists for exactly one response and is never persisted or logged.
 */
const SECRET_BYTES = 32;

/** A namespace prefix, so a device secret can never be replayed as a session token. */
export const SECRET_KINDS = {
  device: 'dev',
  childSession: 'cs',
} as const;

export type SecretKind = (typeof SECRET_KINDS)[keyof typeof SECRET_KINDS];

export type SecretGenerator = Readonly<{
  issue(kind: SecretKind): string;
}>;

export const randomSecrets: SecretGenerator = {
  issue: (kind) => `${kind}_${randomBytes(SECRET_BYTES).toString('base64url')}`,
};

/** Deterministic secrets for tests. A fake at the port, never used in production code. */
export function sequentialSecrets(): SecretGenerator {
  let n = 0;
  return {
    issue: (kind) => {
      n += 1;
      return `${kind}_${'test'.repeat(8)}${String(n).padStart(4, '0')}`;
    },
  };
}

export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

/**
 * Whether a presented secret matches a stored digest, in constant time.
 *
 * Lookup by hash is the fast path and is what the repositories do; this exists for the cases
 * where the row is already in hand and the comparison must not leak its progress.
 */
export function secretMatches(presented: string, storedHash: string): boolean {
  const actual = Buffer.from(hashSecret(presented), 'hex');
  const expected = Buffer.from(storedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** The shape a secret must have before it is worth a database round trip. */
export function isWellFormedSecret(value: string, kind: SecretKind): boolean {
  return value.startsWith(`${kind}_`) && value.length <= 128 && value.length > kind.length + 8;
}
