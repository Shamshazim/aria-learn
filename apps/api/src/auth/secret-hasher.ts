import { hash, verify } from '@node-rs/argon2';

/**
 * Hashing the small secrets a child chooses (P2H-12).
 *
 * A port, because the algorithm is a decision that changes and the services that depend on it
 * should not have to. Argon2id is today's answer; what makes it the right one here is not its
 * strength against a four-digit search space — nothing is — but that it is slow enough that a
 * stolen database cannot be turned into a list of children's PINs in an afternoon. The lockout
 * in `pin.service.ts` is what protects the live door.
 */
export type SecretHasher = Readonly<{
  hash(secret: string): Promise<string>;
  /** False rather than throwing on a malformed stored hash: it is a failed login, not a 500. */
  verify(stored: string, secret: string): Promise<boolean>;
}>;

export const argon2Hasher: SecretHasher = {
  hash: (secret) => hash(secret),
  verify: async (stored, secret) => {
    try {
      return await verify(stored, secret);
    } catch {
      return false;
    }
  },
};
