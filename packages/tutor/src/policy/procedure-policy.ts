import { outcome, plan, type PolicyOutcome } from './outcome';

import type { LoadedTurnContext, SessionSnapshot } from '../types';

/**
 * P3-07: a `procedure` item is worked one step at a time, and its answer is never revealed
 * before the child has had a go at every step.
 *
 * The count is the same one the stuck ladder already keeps: each turn on the item that went
 * nowhere is a turn on the next step, because the hint before it pointed there. So with `n`
 * steps, the hints point at steps 1 to `n` in turn, and only the turn after the last of them
 * may show the answer. A fact or a number-sense item has no steps and is untouched.
 */
export function stepsRemaining(session: SessionSnapshot): boolean {
  return session.consecutiveStuck < (session.procedureSteps ?? 0);
}

/** A hint at the next step of the written method, never its answer and never the whole one. */
export function nextStepOutcome<TModelContext>(
  context: LoadedTurnContext<TModelContext>,
  reasons: readonly string[],
  options?: Parameters<typeof outcome>[2],
): PolicyOutcome {
  const step = context.session.consecutiveStuck + 1;
  const steps = context.session.procedureSteps ?? 0;
  return outcome(
    {
      ...plan(
        'HINT',
        'point-to-step',
        'A procedure is worked a step at a time; point at the next step.',
        context,
      ),
      evidence: { procedureStep: step, procedureSteps: steps },
    },
    [...reasons, 'procedure_next_step'],
    options,
  );
}

/**
 * A skip on a procedure with steps still to try: honoured, with a fresh question, but the
 * answer to this one is not shown. Showing it would be the whole method handed over at once.
 */
export function procedureSkipOutcome<TModelContext>(
  context: LoadedTurnContext<TModelContext>,
  reasons: readonly string[],
): PolicyOutcome {
  return outcome(
    plan(
      'ASK',
      'easier-item',
      'The child skipped a procedure mid-way; move on without showing its answer.',
      context,
    ),
    [...reasons, 'procedure_skip'],
  );
}
