import { z } from 'zod';

import { gradeSchema, turnRequestSchema } from '@aria/shared';

export const createSessionRequestSchema = z
  .object({
    subject: z.string().trim().min(1).max(32),
    grade: gradeSchema,
    arrivalId: z.uuid().optional(),
    fromRecommendation: z.boolean().default(false),
    checkIn: z.string().trim().min(1).max(200).optional(),
  })
  .strict();

export const endSessionRequestSchema = z
  .object({
    sessionId: z.uuid(),
    reason: z.enum(['complete', 'break', 'child_left', 'timeout']),
  })
  .strict();

export const sessionTurnRequestSchema = turnRequestSchema;

export type CreateSessionRequest = z.infer<typeof createSessionRequestSchema>;
export type EndSessionRequest = z.infer<typeof endSessionRequestSchema>;
export type SessionTurnRequest = z.infer<typeof sessionTurnRequestSchema>;
