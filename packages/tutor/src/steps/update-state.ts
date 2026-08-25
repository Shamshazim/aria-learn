import type { CommittedTurn } from '../types';

/** State mutation is part of the atomic commit port; this asserts the graded payload is present. */
export function updateStateIntent(turn: CommittedTurn): CommittedTurn['decision']['graded'] {
  return turn.decision.graded;
}
