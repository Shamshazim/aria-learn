import { describe, expect, it } from 'vitest';

import { argon2Hasher } from './secret-hasher';

/**
 * The real Argon2, not a fake. What is worth proving about a hasher is exactly the part a
 * fake would not have: that the same PIN verifies, that a different one does not, that two
 * children who chose the same PIN do not share a hash, and that a corrupt stored value is a
 * failed login rather than a crash.
 */
describe('hashing a small secret', () => {
  it('verifies the secret it hashed', async () => {
    const stored = await argon2Hasher.hash('4321');

    await expect(argon2Hasher.verify(stored, '4321')).resolves.toBe(true);
    await expect(argon2Hasher.verify(stored, '4322')).resolves.toBe(false);
  });

  it('never stores the secret itself', async () => {
    const stored = await argon2Hasher.hash('4321');

    expect(stored).not.toContain('4321');
    expect(stored.startsWith('$argon2id$')).toBe(true);
  });

  /** Salted: two children with the same PIN must not be visibly the same in a dump. */
  it('gives two identical secrets two different hashes', async () => {
    const first = await argon2Hasher.hash('1111');
    const second = await argon2Hasher.hash('1111');

    expect(first).not.toBe(second);
    await expect(argon2Hasher.verify(second, '1111')).resolves.toBe(true);
  });

  it('treats an unreadable stored hash as a failed login, not as a crash', async () => {
    await expect(argon2Hasher.verify('not-a-hash', '4321')).resolves.toBe(false);
    await expect(argon2Hasher.verify('', '4321')).resolves.toBe(false);
  });
}, 30_000);
