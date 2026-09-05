import type { MoveKind, TutorInputEvent } from '@aria/shared';

import { allowedMovesFor } from './allowed-moves';

import type { MovePlan, PolicyDecision, SessionSnapshot } from '../types';

export type AllowedSetInput = Readonly<{
  event: TutorInputEvent;
  session: SessionSnapshot;
  defaultPlan: MovePlan;
  graded: PolicyDecision['graded'];
  decisive: boolean;
  /** The moves this branch of the policy considers, when the event kind alone is too wide. */
  base?: readonly MoveKind[] | undefined;
}>;

/**
 * What the planner is allowed to choose from: the event's moves ∩ the limits ∩ the ladder.
 *
 * The set is the only thing standing between a model's opinion and a child, so it is computed
 * from state, not from the model's own claim about the state: no praise for a wrong answer, no
 * answer revealed on the first attempt, no goodbye unless the policy already said goodbye.
 * The policy's own plan is always in the set, so there is always something to fall back to.
 */
export function allowedSet(input: AllowedSetInput): readonly MoveKind[] {
  if (input.decisive) return [input.defaultPlan.kind];
  const kept = (input.base ?? allowedMovesFor(input.event)).filter((kind) =>
    permitted(kind, input),
  );
  return kept.includes(input.defaultPlan.kind) ? kept : [input.defaultPlan.kind, ...kept];
}

type Limit = (input: AllowedSetInput) => boolean;

const stillWorking: Limit = (input) => input.graded?.correct !== true;

/**
 * One rule per move that a situation can take off the table. A move with no rule here is
 * allowed whenever its event allows it.
 */
const LIMITS: Readonly<Partial<Record<MoveKind, Limit>>> = {
  PRAISE: (input) => input.graded?.correct === true,
  HINT: stillWorking,
  RETEACH: stillWorking,
  SHOW: stillWorking,
  // Two turns that went nowhere is where productive struggle ends; before that, revealing is
  // giving up for the child. A skip is the child giving up out loud, and is honoured.
  REVEAL: (input) =>
    input.event.kind === 'SKIP' ||
    (input.graded?.correct !== true && input.session.consecutiveStuck >= 2),
  SWITCH: (input) => input.session.unmetPrerequisite !== null,
  // Stopping is the policy's call, never the planner's.
  BREAK: (input) => input.defaultPlan.kind === 'BREAK',
  END: (input) => input.defaultPlan.kind === 'END',
  // P2H-01: a silent child is never told to listen.
  LISTEN: (input) => input.event.kind !== 'SILENCE',
};

function permitted(kind: MoveKind, input: AllowedSetInput): boolean {
  return LIMITS[kind]?.(input) ?? true;
}
