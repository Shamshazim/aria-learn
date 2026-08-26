import { z } from 'zod';

/**
 * The six pictures a child can be, and can log in with (P2H-12).
 *
 * One vocabulary rather than two. A child who cannot read picks their own face out of a row
 * of six, and the same six are what a picture password is a sequence of; giving the avatar
 * set and the login set different members would mean a five-year-old learning two.
 *
 * They are names, not files. The web app owns the drawings; the API only ever stores and
 * compares these strings, so a redesign of the artwork is not a migration.
 */
export const CHILD_PICTURES = ['fox', 'owl', 'whale', 'rocket', 'apple', 'star'] as const;

export type ChildPicture = (typeof CHILD_PICTURES)[number];

export const childPictureSchema = z.enum(CHILD_PICTURES);

/** Three taps. Long enough that a sibling does not guess it, short enough to remember. */
export const PICTURE_SEQUENCE_LENGTH = 3;

export const pictureSequenceSchema = z
  .array(childPictureSchema)
  .length(PICTURE_SEQUENCE_LENGTH)
  .readonly();

/** Four digits, digits only. Anything else is a typo the child should be told about early. */
export const PIN_LENGTH = 4;

export const pinSchema = z.string().regex(/^\d{4}$/u, 'a PIN is four digits');
