import { z } from 'zod';

import { pictureSequenceSchema, pinSchema } from '@aria/shared';

/**
 * What a child login may say (P2H-12).
 *
 * `.strict()` matters more here than anywhere else in the tree: this is the one body an
 * unauthenticated-ish caller can post at us, and a key we do not recognise is a key somebody
 * is hoping we will pass on somewhere.
 *
 * Both credentials are optional and neither is required, because a family device needs
 * neither. Which one this child actually has is not the request's business to assert — the
 * credential service decides, and offering the wrong kind is refused rather than counted.
 */
export const childLoginRequestSchema = z
  .object({
    childId: z.uuid(),
    pin: pinSchema.optional(),
    pictureSequence: pictureSequenceSchema.optional(),
    /** Shown to a parent reviewing devices. Free text, bounded, never spoken to a child. */
    deviceLabel: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

export type ChildLoginRequest = z.infer<typeof childLoginRequestSchema>;
