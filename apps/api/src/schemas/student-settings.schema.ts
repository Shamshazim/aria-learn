import { z } from 'zod';

import { childPictureSchema } from '@aria/shared';

import type { StudentSettings, StudentSettingsPatch } from '@/types/student';

/**
 * The `student.settings` JSONB column, parsed both ways (P2H-12).
 *
 * One schema serves the row and the PATCH body, because they describe the same thing and a
 * second copy would be the one that drifts. Every key has a default, so a row written before
 * this migration — every row — reads back as a whole settings object rather than as holes the
 * callers have to check for.
 */
export const studentSettingsSchema: z.ZodType<StudentSettings> = z
  .object({
    shareFirstName: z.boolean().default(true),
    // Bounded: it is spoken text a parent supplies, and it reaches a speech engine (§8).
    pronunciation: z.string().trim().min(1).max(64).nullable().default(null),
    avatar: childPictureSchema.default('fox'),
  })
  .strict()
  .readonly();

/**
 * What a parent may change, all of it optional.
 *
 * `.partial()` rather than a second literal, so a key added above cannot be forgotten here.
 */
export const studentSettingsPatchSchema: z.ZodType<StudentSettingsPatch> = z
  .object({
    shareFirstName: z.boolean(),
    pronunciation: z.string().trim().min(1).max(64).nullable(),
    avatar: childPictureSchema,
  })
  .partial()
  .strict();
