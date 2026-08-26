import { z } from 'zod';

import { childPictureSchema, gradeSchema, pictureSequenceSchema, pinSchema } from '@aria/shared';

import { studentSettingsPatchSchema } from '@/schemas/student-settings.schema';

/**
 * The parent-facing bodies (P2H-12).
 *
 * A child's name is bounded at the same length the database bounds it, and every field a
 * parent can write is either an enumeration or a short string: nothing here reaches a model
 * or a speech engine without a length somebody chose (§8).
 */
export const childParamsSchema = z.object({ id: z.uuid() }).strict();

const displayNameSchema = z.string().trim().min(1).max(64);

export const createChildRequestSchema = z
  .object({
    displayName: displayNameSchema,
    grade: gradeSchema,
    avatar: childPictureSchema.optional(),
  })
  .strict();

/**
 * `null` clears a login method, an absent key leaves it alone. The two are different
 * instructions, which is why this is not simply a partial of the credential shape.
 */
export const childLoginPatchSchema = z
  .object({
    pin: pinSchema.nullable(),
    pictureSequence: pictureSequenceSchema.nullable(),
    familyDevice: z.boolean(),
  })
  .partial()
  .strict();

export const updateChildRequestSchema = z
  .object({
    displayName: displayNameSchema,
    grade: gradeSchema,
    settings: studentSettingsPatchSchema,
    login: childLoginPatchSchema,
  })
  .partial()
  .strict();

/**
 * Consent is not a checkbox. A parent states which processor categories they accept and
 * supplies the reference of the verification they went through (P2-03); retaining a child's
 * reading audio stays a literal `false` until a ticket deliberately turns it on.
 */
export const parentVoiceConsentSchema = z
  .object({
    processorCategories: z.array(z.enum(['media', 'stt', 'tts'])).length(3),
    retainReadingAudio: z.literal(false).default(false),
    verificationReference: z.string().trim().min(3).max(128),
  })
  .strict();

export type CreateChildRequest = z.infer<typeof createChildRequestSchema>;
export type UpdateChildRequest = z.infer<typeof updateChildRequestSchema>;
export type ParentVoiceConsentRequest = z.infer<typeof parentVoiceConsentSchema>;
