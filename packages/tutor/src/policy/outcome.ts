import type { MoveKind } from '@aria/shared';

import type { LoadedTurnContext, MovePlan, PolicyDecision } from '../types';

/**
 * What one branch of the policy decided, before the allowed set is computed (P2H-06).
 *
 * The branches say what should happen and why; the allowed set is derived once, from the
 * reasons and the session state, so that "what may the planner do here" has exactly one
 * definition instead of one per branch.
 */
export type PolicyOutcome = Readonly<{
  plan: MovePlan;
  graded: PolicyDecision['graded'];
  terminal: boolean;
  reasons: readonly string[];
  /** The moves this branch considers, when the event kind alone is the wrong question. */
  base?: readonly MoveKind[];
}>;

export function outcome(
  plan: MovePlan,
  reasons: readonly string[],
  options?: Readonly<{
    graded?: PolicyDecision['graded'];
    terminal?: boolean;
    base?: readonly MoveKind[];
  }>,
): PolicyOutcome {
  return {
    plan,
    graded: options?.graded ?? null,
    terminal: options?.terminal ?? false,
    reasons,
    ...(options?.base === undefined ? {} : { base: options.base }),
  };
}

export function plan<TModelContext>(
  kind: MoveKind,
  approach: string,
  reason: string,
  context: LoadedTurnContext<TModelContext>,
): MovePlan {
  return {
    kind,
    approach,
    reason,
    skillCode: context.session.skillCode,
    attempt: Math.min(10, context.session.consecutiveWrong + 1),
    source: 'policy',
  };
}

export function nextApproach<TModelContext>(context: LoadedTurnContext<TModelContext>): string {
  return context.session.lastApproach === 'visual-model' ? 'worked-example' : 'visual-model';
}
