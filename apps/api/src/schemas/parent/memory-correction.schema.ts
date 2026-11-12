import { z } from 'zod';

import { CORRECTION_TARGETS } from '@aria/shared';

/**
 * A parent correcting what Aria remembers about their child (P3-06).
 *
 * `replace` needs a new value and `retract` refuses one. The value is the sentence Aria will
 * remember instead, bounded like every other parent-written string; whether it is something
 * Aria may remember at all (not sensitive, not a judgement) is the service's call, and a 422.
 */
export const memoryCorrectionRequestSchema = z
  .strictObject({
    targetKind: z.enum(CORRECTION_TARGETS),
    targetId: z.uuid(),
    action: z.enum(['retract', 'replace']),
    newValue: z.strictObject({ text: z.string().trim().min(1).max(200) }).optional(),
    reason: z.string().trim().min(1).max(300).optional(),
  })
  .refine((body) => (body.action === 'replace') === (body.newValue !== undefined), {
    message: 'replace needs a newValue; retract takes none',
    path: ['newValue'],
  });

export type MemoryCorrectionRequest = z.infer<typeof memoryCorrectionRequestSchema>;

export const memoryCorrectionResponseSchema = z.strictObject({
  status: z.enum(['applied', 'unchanged']),
  correctionId: z.uuid().nullable(),
  replacementId: z.uuid().nullable(),
});

export type MemoryCorrectionResponse = z.infer<typeof memoryCorrectionResponseSchema>;
