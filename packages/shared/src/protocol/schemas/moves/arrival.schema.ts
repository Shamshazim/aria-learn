import { z } from 'zod';

import { gradeSchema } from '../../../band/band';

import { MAX_REASON, move } from './move-base';

/**
 * The moves that open the relationship, before a class is chosen (`master-plan.md` §4.1).
 *
 * These are assembled from prepared plans or verified templates rather than generated, so
 * arrival never waits on a model — the latency rule in §4.1 applies most sharply here.
 */

/** "Welcome back, Ajmal. Yesterday you stuck with regrouping even when it was hard." */
export const welcomeMoveSchema = move('WELCOME', {
  /** Continuity the greeting was built from, so a wrong greeting is traceable to its evidence. */
  basedOn: z.array(z.string().min(1).max(200)).max(5).default([]),
});

/** "Do you want something easy to start, or are you ready for a challenge?" */
export const checkInMoveSchema = move('CHECK_IN', {
  about: z.enum(['mood', 'energy', 'difficulty', 'preference']),
});

/**
 * "Reading is due today. I think we should start there."
 *
 * A recommendation, never a redirect: the child still chooses the class. `SUBJECT_CHOSEN`
 * records whether they took it.
 */
export const recommendMoveSchema = move('RECOMMEND', {
  subjectId: z.string().min(1).max(64),
  grade: gradeSchema,
  reason: z.string().min(1).max(MAX_REASON),
});

export const ARRIVAL_MOVE_SCHEMAS = [
  welcomeMoveSchema,
  checkInMoveSchema,
  recommendMoveSchema,
] as const;
