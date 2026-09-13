import { z } from 'zod';

import { gradeSchema } from '@aria/shared';

/**
 * `grade` is a development-only override: the picker's grade dropdown asks for another
 * grade's classes. It is honoured only where `allowGradeOverride` is on, and ignored otherwise.
 */
export const arrivalRequestSchema = z.object({ grade: gradeSchema.optional() }).strict();
export type ArrivalRequest = z.infer<typeof arrivalRequestSchema>;
