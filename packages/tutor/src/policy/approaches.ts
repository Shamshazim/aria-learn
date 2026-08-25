import type { MoveKind } from '@aria/shared';

/**
 * The approaches the planner may choose from, one move at a time (P2H-06).
 *
 * Closed on purpose. An approach changes what a move *is* — a `RETEACH` with a visual model
 * and a `RETEACH` with a concrete story are two different lessons — so a planner that could
 * invent approach names could invent a lesson nobody wrote a prompt for. Anything outside
 * this table is rejected and the policy's own plan is used instead.
 *
 * The policy is not bound by it: policy defaults carry their own approach names (the silence
 * ladder's `check-in`, the misconception fix), and those are reviewed text, not a proposal.
 */
export const PLANNER_APPROACHES = {
  WELCOME: ['default'],
  CHECK_IN: ['default'],
  RECOMMEND: ['default'],
  SAY: ['answer-question', 'acknowledge-chat', 'confirm-spoken-answer', 'teach'],
  SHOW: ['default'],
  ASK: ['same-item', 'easier-item', 'reask-short'],
  LISTEN: ['default'],
  HINT: ['point-to-step', 'worked-similar', 'narrow-choice'],
  RETEACH: ['visual-model', 'concrete-story', 'simpler-case'],
  REVEAL: ['default'],
  PRAISE: ['default'],
  SWITCH: ['default'],
  BREAK: ['default'],
  END: ['default'],
} as const satisfies Readonly<Record<MoveKind, readonly string[]>>;

export function approachesFor(kind: MoveKind): readonly string[] {
  return PLANNER_APPROACHES[kind];
}

export function isPlannerApproach(kind: MoveKind, approach: string): boolean {
  return approachesFor(kind).includes(approach);
}
