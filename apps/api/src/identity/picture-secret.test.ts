import { describe, expect, it } from 'vitest';

import type { PictureSecret } from '@aria/shared';

import { hashPictureSecret, pictureSecretMatches } from './picture-secret';

/**
 * The credential a five-year-old uses, so the properties that matter are the boring ones:
 * order is part of the secret, the same secret hashes differently for two children, and a
 * corrupt stored value is a mismatch rather than a crash or — far worse — a match.
 */
const SECRET: PictureSecret = ['apple', 'moon', 'apple', 'kite'];

describe('picture secret', () => {
  it('matches the sequence it was created from', async () => {
    const stored = await hashPictureSecret(SECRET);
    await expect(pictureSecretMatches(SECRET, stored)).resolves.toBe(true);
  });

  it('treats order as part of the secret', async () => {
    const stored = await hashPictureSecret(SECRET);
    await expect(pictureSecretMatches(['moon', 'apple', 'apple', 'kite'], stored)).resolves.toBe(
      false,
    );
  });

  it('rejects a different sequence of the same length', async () => {
    const stored = await hashPictureSecret(SECRET);
    await expect(pictureSecretMatches(['apple', 'moon', 'apple', 'ball'], stored)).resolves.toBe(
      false,
    );
  });

  it('salts each hash, so two children with the same pictures do not share a stored value', async () => {
    const [first, second] = await Promise.all([
      hashPictureSecret(SECRET),
      hashPictureSecret(SECRET),
    ]);

    expect(first).not.toEqual(second);
    await expect(pictureSecretMatches(SECRET, first)).resolves.toBe(true);
    await expect(pictureSecretMatches(SECRET, second)).resolves.toBe(true);
  });

  it('carries its cost parameters, so they can be raised without invalidating stored secrets', async () => {
    expect(await hashPictureSecret(SECRET)).toMatch(/^scrypt\$\d+\$\d+\$\d+\$[\w-]+\$[\w-]+$/);
  });

  it.each([
    ['an empty string', ''],
    ['a value from another scheme', 'sha256:deadbeef'],
    ['a truncated encoding', 'scrypt$131072$8$1$onlyfourfields'],
  ])('does not match against %s', async (_name, stored) => {
    await expect(pictureSecretMatches(SECRET, stored)).resolves.toBe(false);
  });

  it('refuses to hash a sequence that is not four pictures', async () => {
    // Typed as the domain type; the length is what the runtime guard exists to catch, because
    // a shorter secret would hash happily and be far easier to guess.
    const tooShort: PictureSecret = ['apple', 'moon'];
    await expect(hashPictureSecret(tooShort)).rejects.toThrow(RangeError);
  });
});
