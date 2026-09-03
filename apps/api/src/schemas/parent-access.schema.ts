import { z } from 'zod';

import { pictureSequenceSchema, pinSchema } from '@aria/shared';

import { CONSENT_METHODS } from '@/types/parent-access';

/**
 * The bodies P0-28 adds (consent, devices, deletion).
 *
 * Bounded at both ends throughout, and `.strict()` everywhere: a field nobody reads becomes a
 * 400 rather than something silently ignored, which is how a client comes to believe it sent
 * something we honoured (§8).
 */
export const grantConsentSchema = z
  .object({
    method: z.enum(CONSENT_METHODS),
    /** The payment or agreement id. Adult-side by construction — never a fact about a child. */
    sourceReference: z.string().trim().min(1).max(200).nullable().default(null),
    /** Which wording the parent was actually shown. A consent that cannot say is unauditable. */
    disclosureVersion: z.string().trim().min(1).max(40),
  })
  .strict();

/** Eight is a family, not a limit anybody will meet; it is here so the array has a ceiling. */
export const createDeviceSchema = z
  .object({
    label: z.string().trim().min(1).max(60),
    childIds: z.array(z.uuid()).min(1).max(8),
  })
  .strict();

export const deviceParamsSchema = z.object({ id: z.uuid() }).strict();

/**
 * A child signing in from a trusted device. The device proves itself with a header, so the
 * body only has to say which child and what they tapped.
 */
export const deviceLoginSchema = z
  .object({
    childId: z.uuid(),
    pin: pinSchema.optional(),
    pictureSequence: pictureSequenceSchema.optional(),
  })
  .strict();
