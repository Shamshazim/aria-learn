import { z } from 'zod';

import { AVATAR_KEYS, SECRET_PICTURE_KEYS, SECRET_PICTURE_LENGTH } from './pictures.data';

export { AVATAR_KEYS, SECRET_PICTURE_KEYS, SECRET_PICTURE_LENGTH };

export type AvatarKey = (typeof AVATAR_KEYS)[number];
export type SecretPictureKey = (typeof SECRET_PICTURE_KEYS)[number];

/** The four pictures a child taps, in order. Order is part of the secret. */
export type PictureSecret = readonly SecretPictureKey[];

export const avatarKeySchema = z.enum(AVATAR_KEYS);
export const secretPictureKeySchema = z.enum(SECRET_PICTURE_KEYS);

/**
 * Exactly four keys from the vocabulary, in order.
 *
 * Bounded at both ends deliberately (CODE-STANDARDS §8): a caller cannot lengthen the
 * sequence to make hashing expensive, nor shorten it to make guessing cheap.
 */
export const pictureSecretSchema = z
  .array(secretPictureKeySchema)
  .length(SECRET_PICTURE_LENGTH)
  .readonly();

export function isAvatarKey(value: string): value is AvatarKey {
  return (AVATAR_KEYS as readonly string[]).includes(value);
}
