import { z } from 'zod';

import { bandSchema, gradeSchema } from '../../band/band';

import { tutorMoveSchema } from './moves.schema';
import { sessionContextSchema } from './session.schema';

export const arrivalResponseSchema = z.object({
  arrivalId: z.uuid(),
  moves: z.array(tutorMoveSchema).min(2).max(3),
  recommendedSubject: z.string().min(1).max(64).nullable(),
  student: z.object({ grade: gradeSchema, band: bandSchema }),
  /** The classes the picker shows this child, in the order they are shown. */
  classes: z
    .array(
      z.object({
        subjectId: z.string().min(1).max(64),
        name: z.string().min(1).max(120),
        grade: gradeSchema,
      }),
    )
    .max(16),
});

export const sessionStartResponseSchema = z.object({
  session: sessionContextSchema,
  moves: z.array(tutorMoveSchema).max(64),
  resumed: z.boolean(),
});

export const currentSessionResponseSchema = z
  .object({
    session: sessionContextSchema,
    moves: z.array(tutorMoveSchema).max(256),
    lastAppliedSeq: z.number().int().nonnegative(),
  })
  .nullable();

export const endSessionResponseSchema = z.object({
  sessionId: z.string().min(1).max(128),
  endedAt: z.iso.datetime({ offset: false }),
  reason: z.enum(['complete', 'break', 'child_left', 'timeout']),
});

export type ArrivalResponse = z.infer<typeof arrivalResponseSchema>;
export type SessionStartResponse = z.infer<typeof sessionStartResponseSchema>;
export type CurrentSessionResponse = z.infer<typeof currentSessionResponseSchema>;
export type EndSessionResponse = z.infer<typeof endSessionResponseSchema>;
