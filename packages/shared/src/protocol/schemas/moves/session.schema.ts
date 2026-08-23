import { z } from 'zod';

import { gradeSchema } from '../../../band/band';

import { MAX_REASON, MAX_REF, move } from './move-base';

/**
 * The moves that change or close the session.
 *
 * All three are Aria's decision to stop pushing, and each states why. A session that ends
 * without a recorded reason cannot be explained to a parent later (`master-plan.md` §4.1).
 */

/** "This skill is not working today." Move on; come back tomorrow. */
export const switchMoveSchema = move('SWITCH', {
  fromSkillId: z.string().min(1).max(MAX_REF).optional(),
  toSubjectId: z.string().min(1).max(MAX_REF).optional(),
  toGrade: gradeSchema.optional(),
  reason: z.string().min(1).max(MAX_REASON),
});

/** "Let's stop here. Same time tomorrow?" Attention is gone; this is not a failure. */
export const breakMoveSchema = move('BREAK', {
  reason: z.enum(['attention', 'frustration', 'time_limit', 'child_asked']),
});

/** Wrap up, and tell them what they learned. */
export const endMoveSchema = move('END', {
  /** Plain sentences the child hears, and the same evidence a parent digest is built from. */
  learned: z.array(z.string().min(1).max(MAX_REASON)).max(5).default([]),
  reason: z.enum(['complete', 'time_limit', 'child_left', 'break']).default('complete'),
});

export const SESSION_MOVE_SCHEMAS = [switchMoveSchema, breakMoveSchema, endMoveSchema] as const;
