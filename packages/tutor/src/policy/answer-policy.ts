import { nextApproach, outcome, plan, type PolicyOutcome } from './outcome';
import { MASTERED_TOPIC_REASON, MASTERY_STREAK, nextTopicOutcome } from './stuck-policy';

import type { LoadedTurnContext, PolicyDecision } from '../types';

type Graded = NonNullable<PolicyDecision['graded']>;

/** Wrong answers across items, on top of a stuck item, before the prerequisite is the answer. */
const STUCK_SKILL_WRONG = 3;

/**
 * What a graded answer earns. The allowed set widens around each of these (P2H-06): the plan
 * here is what happens if no planner answers in time, not the only thing that may happen.
 */
export function answerOutcome<TModelContext>(
  context: LoadedTurnContext<TModelContext>,
  graded: Graded,
): PolicyOutcome {
  if (graded.correct) return correctOutcome(context, graded);
  return wrongAnswerOutcome(context, graded);
}

/**
 * Praise, or — when this right answer makes a run of them and there is somewhere to go — the
 * next topic. A session that stays on one topic after the child has shown they have it is
 * drilling, not tutoring.
 */
function correctOutcome<TModelContext>(
  context: LoadedTurnContext<TModelContext>,
  graded: Graded,
): PolicyOutcome {
  if (context.session.correctStreak >= MASTERY_STREAK - 1 && context.session.nextTopic !== null) {
    return nextTopicOutcome(context, MASTERED_TOPIC_REASON, ['correct_answer', 'mastered_topic'], {
      graded,
    });
  }
  return outcome(
    plan('PRAISE', 'specific-evidence', 'The answer was correct.', context),
    ['correct_answer'],
    { graded },
  );
}

/**
 * Where a wrong answer goes: one nudge, the idea another way, then the answer and a fresh
 * question — or, when the whole skill is not working, back to the step underneath it.
 */
function wrongAnswerOutcome<TModelContext>(
  context: LoadedTurnContext<TModelContext>,
  graded: Graded,
): PolicyOutcome {
  const { consecutiveStuck, consecutiveWrong, unmetPrerequisite } = context.session;
  if (consecutiveStuck >= 2) {
    if (consecutiveWrong >= STUCK_SKILL_WRONG && unmetPrerequisite !== null) {
      return outcome(
        {
          ...plan(
            'SWITCH',
            'prerequisite-step',
            'The current skill is stuck; return to its unmet prerequisite.',
            context,
          ),
          skillCode: unmetPrerequisite,
        },
        ['stuck_on_skill'],
        { graded },
      );
    }
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
  if (consecutiveStuck === 1) {
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
