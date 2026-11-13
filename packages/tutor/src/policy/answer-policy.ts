import { shouldReteachWithFix, sighted } from '../scheduler/misconception';

import { nextApproach, outcome, plan, type PolicyOutcome } from './outcome';
import { nextStepOutcome, stepsRemaining } from './procedure-policy';
import { MASTERED_TOPIC_REASON, MASTERY_STREAK, nextTopicOutcome } from './stuck-policy';

import type { LoadedTurnContext, PolicyDecision } from '../types';

type Graded = NonNullable<PolicyDecision['graded']>;

/** Wrong answers in a row on the skill, this one included, at which a stuck item goes back. */
const STEP_BACK_WRONG = 3;

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
 * Where a wrong answer goes: one nudge, the idea another way, then the answer shown and a
 * fresh question — or, when this is the third wrong answer in a row on the skill, back to the
 * weakest step underneath it (P3-04, §4.4: the scheduler goes *backwards* when a child is
 * stuck). A shrug counts towards moving on but not towards going back: "I don't know" says
 * nothing about the ground under the skill.
 *
 * Two misses that show *different* wrong ideas go back sooner, on the second: the child is not
 * holding one wrong idea that a reteach can fix, they are missing the ground the skill stands
 * on. The same wrong idea twice is the opposite case, and gets its recorded fix.
 */
function wrongAnswerOutcome<TModelContext>(
  context: LoadedTurnContext<TModelContext>,
  graded: Graded,
): PolicyOutcome {
  const { consecutiveStuck, unmetPrerequisite } = context.session;
  if (stepsRemaining(context.session)) return procedureWrongOutcome(context, graded);
  if (consecutiveStuck >= 2) {
    if (unmetPrerequisite !== null && wrongInARow(context) >= STEP_BACK_WRONG) {
      return stepBackOutcome(context, graded, ['stuck_on_skill']);
    }
    return outcome(
      plan('REVEAL', 'worked-example', 'Productive struggle is over.', context),
      ['struggle_over'],
      { graded },
    );
  }
  if (isRepeatedMisconception(context, graded)) {
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
    const changed = differentSignatures(context, graded) ? changeOfGround(context, graded) : null;
    if (changed !== null) return changed;
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

/**
 * P3-07: a wrong answer on a procedure with steps still to try. A wrong idea seen before still
 * gets its recorded fix; otherwise the next step is pointed at. No step back yet: walking the
 * steps is how a child shows which one they cannot do, and stepping back first would skip it.
 */
function procedureWrongOutcome<TModelContext>(
  context: LoadedTurnContext<TModelContext>,
  graded: Graded,
): PolicyOutcome {
  if (isRepeatedMisconception(context, graded)) {
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
  return nextStepOutcome(context, ['wrong_attempt'], { graded });
}

function wrongInARow<TModelContext>(context: LoadedTurnContext<TModelContext>): number {
  return (context.session.wrongOnSkill ?? context.session.consecutiveWrong) + 1;
}

/**
 * The second sighting of a misconception, counting this one: seen earlier in this session, or
 * on record from an earlier one and not since cleared.
 */
function isRepeatedMisconception<TModelContext>(
  context: LoadedTurnContext<TModelContext>,
  graded: Graded,
): boolean {
  const seen = graded.misconception;
  if (seen === null) return false;
  if (seen === context.session.repeatedMisconception) return true;
  const history = context.session.misconceptionHistory?.[seen];
  return history !== undefined && shouldReteachWithFix(sighted(history));
}

function differentSignatures<TModelContext>(
  context: LoadedTurnContext<TModelContext>,
  graded: Graded,
): boolean {
  const previous = context.session.previousMisconception ?? null;
  return previous !== null && graded.misconception !== null && previous !== graded.misconception;
}

/** Back to the weakest prerequisite, or across to another strand when nothing is weak. */
function changeOfGround<TModelContext>(
  context: LoadedTurnContext<TModelContext>,
  graded: Graded,
): PolicyOutcome | null {
  const reasons = ['different_misconceptions'];
  if (context.session.unmetPrerequisite !== null) {
    return stepBackOutcome(context, graded, reasons);
  }
  const other = context.session.alternateStrandSkill ?? null;
  if (other === null) return null;
  return outcome(
    {
      ...plan('SWITCH', 'other-strand', 'Nothing underneath is weak; change strand.', context),
      skillCode: other,
    },
    [...reasons, 'switch_strand'],
    { graded },
  );
}

function stepBackOutcome<TModelContext>(
  context: LoadedTurnContext<TModelContext>,
  graded: Graded,
  reasons: readonly string[],
): PolicyOutcome {
  return outcome(
    {
      ...plan(
        'SWITCH',
        'prerequisite-step',
        'The current skill is stuck; return to its weakest prerequisite.',
        context,
      ),
      skillCode: context.session.unmetPrerequisite,
    },
    [...reasons, 'step_back'],
    { graded },
  );
}
