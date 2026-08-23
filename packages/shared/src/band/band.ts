import { z } from 'zod';

import { GRADES, GRADE_TO_BAND, type Grade } from './band.data';

/**
 * The three age bands the child experience is rendered in.
 *
 * A band selects a *rendering* — density, wording, animation and the answer control. It
 * never selects a different set of moves: nothing in the protocol is band-specific, so the
 * tutor loop cannot teach a six-year-old differently from an eight-year-old as a side effect
 * of a layout decision.
 */
export const BANDS = ['early', 'middle', 'senior'] as const;

export const bandSchema = z.enum(BANDS);
export type Band = z.infer<typeof bandSchema>;

export const gradeSchema = z.enum(GRADES);

/**
 * The band a grade is rendered in.
 *
 * Total by construction: every member of `Grade` has a row in the table, so there is no
 * fallback branch to get wrong. Callers holding an unvalidated string go through
 * `parseGrade` first and decide for themselves what a missing grade means.
 */
export function bandForGrade(grade: Grade): Band {
  return GRADE_TO_BAND[grade];
}

/**
 * Narrows untrusted input — a URL parameter, a stored profile, a curriculum file — to a
 * `Grade`, returning `null` rather than throwing. Data entering the process is parsed, never
 * asserted (CODE-STANDARDS §1).
 */
export function parseGrade(value: unknown): Grade | null {
  const result = gradeSchema.safeParse(value);
  return result.success ? result.data : null;
}

export { GRADES, type Grade };
