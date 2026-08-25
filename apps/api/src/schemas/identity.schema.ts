import { z } from 'zod';

import { avatarKeySchema, gradeSchema, pictureSecretSchema } from '@aria/shared';

import { ADULT_ROLES, CONSENT_METHODS } from '@/types/identity';

/**
 * Request shapes for every identity endpoint.
 *
 * Bounded at both ends throughout (CODE-STANDARDS §8): a token has a ceiling, a label has a
 * ceiling, and the number of children one device may be scoped to has a ceiling. `.strict()`
 * everywhere, so a field nobody reads is a 400 rather than something silently ignored — which
 * is how a client comes to believe it sent something we honoured.
 */
const accessTokenSchema = z.string().trim().min(16).max(4096);

/** The FTC age/role gate, as a request field. `isAdult: false` never creates a row. */
export const adultSignInSchema = z
  .object({
    accessToken: accessTokenSchema,
    attestation: z
      .object({
        isAdult: z.boolean(),
        role: z.enum(ADULT_ROLES),
        displayName: z.string().trim().min(1).max(80).optional(),
      })
      .strict(),
  })
  .strict();

export const magicLinkSchema = z
  .object({
    email: z.email().max(320),
  })
  .strict();

export const consentSchema = z
  .object({
    method: z.enum(CONSENT_METHODS),
    /** The payment or school-agreement id. Adult-side by construction — never a child field. */
    sourceReference: z.string().trim().min(1).max(200).nullable().default(null),
  })
  .strict();

export const createChildSchema = z
  .object({
    /** A nickname, not a legal name: §12.2 asks for the least identifying thing that works. */
    nickname: z.string().trim().min(1).max(40),
    grade: gradeSchema,
    avatarKey: avatarKeySchema,
    pictureSecret: pictureSecretSchema,
  })
  .strict();

export const setPictureSecretSchema = z
  .object({
    avatarKey: avatarKeySchema.nullable().default(null),
    pictureSecret: pictureSecretSchema,
  })
  .strict();

/** Eight is a large family and a hard ceiling; an unbounded array is an unbounded query. */
export const createDeviceGrantSchema = z
  .object({
    label: z.string().trim().min(1).max(60),
    studentIds: z.array(z.uuid()).min(1).max(8),
  })
  .strict();

export const openChildSessionSchema = z
  .object({
    studentId: z.uuid(),
    pictureSecret: pictureSecretSchema,
  })
  .strict();

export const studentIdParamSchema = z.object({ studentId: z.uuid() }).strict();
export const grantIdParamSchema = z.object({ grantId: z.uuid() }).strict();

export type AdultSignInRequest = z.infer<typeof adultSignInSchema>;
export type MagicLinkRequest = z.infer<typeof magicLinkSchema>;
export type ConsentRequest = z.infer<typeof consentSchema>;
export type CreateChildRequest = z.infer<typeof createChildSchema>;
export type SetPictureSecretRequest = z.infer<typeof setPictureSecretSchema>;
export type CreateDeviceGrantRequest = z.infer<typeof createDeviceGrantSchema>;
export type OpenChildSessionRequest = z.infer<typeof openChildSessionSchema>;
