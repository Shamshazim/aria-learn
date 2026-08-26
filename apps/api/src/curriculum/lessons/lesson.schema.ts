import { z } from 'zod';

import type { LessonNote } from '@/curriculum/lessons/lesson.types';

const prose = z.string().min(20).max(1_200);
const phrases = z.array(z.string().min(1).max(300));

/**
 * The shape a note has to hold before it can ground a prompt.
 *
 * The minimums are the ticket's, not decoration: three stumbles is what makes a `RETEACH`
 * able to be different from the explanation that already failed, and two models is what makes
 * the second attempt a different picture rather than the same one said louder.
 */
export const lessonNoteSchema: z.ZodType<LessonNote> = z.object({
  id: z.string().min(1).max(128),
  skillCode: z.string().min(1).max(64),
  review: z.object({
    status: z.enum(['pending', 'approved']),
    reviewer: z.string().min(1).max(120).optional(),
    reviewedAt: z.iso.datetime().optional(),
  }),
  whatItIs: prose,
  oneIdea: prose,
  stumbles: phrases.min(3).max(8),
  models: phrases.length(2),
  workedExample: prose,
  useLanguage: phrases.min(2).max(12),
  avoidLanguage: phrases.min(2).max(12),
});
