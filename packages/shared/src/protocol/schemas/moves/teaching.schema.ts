import { z } from 'zod';

import { MAX_REF, move } from './move-base';

/**
 * The moves that carry the lesson forward: explain, show, question, listen.
 *
 * `skillId` appears on each of them because every teaching move is evidence about a skill —
 * that is what lets skill state be updated from the session log rather than from a separate
 * bookkeeping path (`master-plan.md` §4.1 step 6).
 */

const skillRef = z.string().min(1).max(MAX_REF).optional();

/** "A fraction is just a number of equal pieces. Watch." */
export const sayMoveSchema = move('SAY', { skillId: skillRef });

/** Put something visual on screen — a number line, a manipulative, a picture. */
export const showMoveSchema = move('SHOW', { skillId: skillRef });

/**
 * "How many quarters make a whole?"
 *
 * `answerKey` is deliberately absent: the correct answer never travels to the browser with
 * the question. Grading happens server-side against the stored item.
 */
export const askMoveSchema = move('ASK', {
  skillId: skillRef,
  /** Identifies the item this question came from, so the answer can be graded against it. */
  itemId: z.string().min(1).max(MAX_REF).optional(),
  attempt: z.number().int().min(1).max(10).default(1),
});

/** "Read this sentence out loud to me." Phase 4 measures the reading; the move already exists. */
export const listenMoveSchema = move('LISTEN', {
  skillId: skillRef,
  purpose: z.enum(['read_aloud', 'explain', 'answer']).default('answer'),
});

export const TEACHING_MOVE_SCHEMAS = [
  sayMoveSchema,
  showMoveSchema,
  askMoveSchema,
  listenMoveSchema,
] as const;
