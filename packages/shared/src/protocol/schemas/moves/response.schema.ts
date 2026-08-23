import { z } from 'zod';

import { MAX_REASON, MAX_REF, move } from './move-base';

/**
 * The moves that answer what the child just did.
 *
 * The escalation they encode — hint once, reteach on a repeated same-way error, reveal when
 * the struggle has stopped being productive — is the teaching policy, and it lives in the
 * service (P0-08 / P1-08). The protocol only has to be able to express each step.
 */

const skillRef = z.string().min(1).max(MAX_REF).optional();

/** "Look at the bottom number first." One nudge, not the answer. */
export const hintMoveSchema = move('HINT', {
  skillId: skillRef,
  /** Which attempt this hint follows; a second hint on the same item reads differently. */
  attempt: z.number().int().min(1).max(10).default(1),
});

/**
 * Explain again, differently, simpler — after the same mistake twice.
 *
 * `misconception` names what is actually being corrected, so a reteach can be checked
 * against the error it claims to address instead of being a louder repeat.
 */
export const reteachMoveSchema = move('RETEACH', {
  skillId: skillRef,
  misconception: z.string().min(1).max(MAX_REASON).optional(),
});

/** Show the answer with the reasoning, once the struggle has stopped being productive. */
export const revealMoveSchema = move('REVEAL', {
  skillId: skillRef,
  /** The answer as the child should see it — resolved to something on their screen. */
  answer: z.string().min(1).max(MAX_REASON),
});

/** Specific, never "good job". `because` is what makes it specific. */
export const praiseMoveSchema = move('PRAISE', {
  skillId: skillRef,
  because: z.string().min(1).max(MAX_REASON),
});

export const RESPONSE_MOVE_SCHEMAS = [
  hintMoveSchema,
  reteachMoveSchema,
  revealMoveSchema,
  praiseMoveSchema,
] as const;
