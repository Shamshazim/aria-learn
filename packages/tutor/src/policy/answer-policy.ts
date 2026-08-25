import { nextApproach, outcome, plan, type PolicyOutcome } from './outcome';

import type { LoadedTurnContext, PolicyDecision } from '../types';

type Graded = NonNullable<PolicyDecision['graded']>;

/**
 * What a graded answer earns. The allowed set widens around each of these (P2H-06): the plan
 * here is what happens if no planner answers in time, not the only thing that may happen.
 */
export function answerOutcome<TModelContext>(
  context: LoadedTurnContext<TModelContext>,
  graded: Graded,
): PolicyOutcome {
  if (graded.correct) {
    return outcome(
      plan('PRAISE', 'specific-evidence', 'The answer was correct.', context),
      ['correct_answer'],
      { graded },
    );
  }
  return wrongAnswerOutcome(context, graded);
}

/** Where a wrong answer goes: back a step, out into the open, or one more try. */
function wrongAnswerOutcome<TModelContext>(
  context: LoadedTurnContext<TModelContext>,
  graded: Graded,
): PolicyOutcome {
  if (context.session.consecutiveWrong >= 3 && context.session.unmetPrerequisite !== null) {
    return outcome(
      {
        ...plan(
          'SWITCH',
          'prerequisite-step',
          'The current skill is stuck; return to its unmet prerequisite.',
          context,
        ),
        skillCode: context.session.unmetPrerequisite,
      },
      ['stuck_on_skill'],
      { graded },
    );
  }
  if (context.session.consecutiveWrong >= 2) {
    return outcome(
      plan('REVEAL', 'worked-example', 'Productive struggle is over.', context),
      ['struggle_over'],
      { graded },
    );
  }
  if (
    graded.misconception !== null &&
    graded.misconception === context.session.repeatedMisconception
  ) {
    return outcome(
      plan(
        'RETEACH',
        'misconception-fix',
        'This misconception was seen before; use its recorded fix.',
        context,
      ),
      ['repeated_misconception'],
      { graded },
    );
  }
  if (context.session.consecutiveWrong === 1) {
    return outcome(
      plan('RETEACH', nextApproach(context), 'The prior approach did not work.', context),
      ['second_wrong_attempt'],
      { graded },
    );
  }
  return outcome(
    plan('HINT', 'single-nudge', 'This is the first incorrect attempt.', context),
    ['first_wrong_attempt'],
    { graded },
  );
}
