import type { MoveKind } from '@aria/shared';

/** Logged, and written to the turn's reasons, whenever the invariant rewrites a plan. */
export const STUCK_TWICE_EVENT = 'policy.invariant.stuck-twice';
export const STUCK_TWICE_REASON = 'invariant_stuck_twice';

export type StuckTwiceInput = Readonly<{
  /** Wrong answers in a row on the current skill, this turn's answer included. */
  wrongOnSkill: number;
  /**
   * Turns on the current item that went nowhere before this one. The ladder's first stuck
   * turn is the hint, so a count above zero means this item has had its hint.
   */
  stuckOnItem: number;
  /**
   * P3-07: this hint points at a step of a written method the child has not had yet. That is
   * different work each time, so it is a change and the once-per-item limit does not apply.
   */
  newProcedureStep?: boolean;
  kind: MoveKind;
}>;

/**
 * The moves that may not follow two wrong answers on one skill (§5: "two wrong answers must
 * never happen twice in a row without Aria changing what she is doing").
 *
 * Asking again is the thing she must not do. A hint is allowed once per item and no more —
 * except a hint at the next step of a written method, which points at new work (P3-07). A
 * reteach, a step back, a switch, a break, showing the answer — each of those is a change.
 */
export function forbiddenAfterStuck(input: Omit<StuckTwiceInput, 'kind'>): readonly MoveKind[] {
  if (input.wrongOnSkill < 2) return [];
  return input.stuckOnItem > 0 && input.newProcedureStep !== true ? ['ASK', 'HINT'] : ['ASK'];
}

/**
 * Whether a move breaks the invariant, and the move to make instead. `null` means the move
 * is allowed. The replacement is a reteach: a different explanation is always available,
 * where a prerequisite or another strand might not be — the policy offers those first.
 */
export function neverStuckTwice(
  input: StuckTwiceInput,
): Readonly<{ kind: 'RETEACH'; reason: string }> | null {
  if (!forbiddenAfterStuck(input).includes(input.kind)) return null;
  return {
    kind: 'RETEACH',
    reason: `Two wrong answers on this skill; ${input.kind} again would change nothing.`,
  };
}
