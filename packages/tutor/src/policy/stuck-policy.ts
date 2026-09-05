import type { MoveKind, SkipReason } from '@aria/shared';

import { nextApproach, outcome, plan, type PolicyOutcome } from './outcome';

import type { LoadedTurnContext } from '../types';

/**
 * What a tutor does when a child is stuck, or has stopped trying.
 *
 * The rule is the one a good human tutor follows without thinking about it: one nudge, then
 * the idea another way, then show the answer and go to a fresh question. It is counted per
 * item, and it does not care *how* the child got stuck — three wrong guesses, three shrugs of
 * "I don't know", or a mixture reach the same third turn. Before this a shrug earned a
 * reteach every time, so a child who said "I don't know" was asked the same question until
 * they gave up on the session.
 *
 * A skip is the child saying it out loud. It is honoured at once: the answer is shown, kindly
 * and briefly, and the next question follows. "Too easy" goes to the next topic instead when
 * there is one.
 */
export const STUCK_BASE: readonly MoveKind[] = ['HINT', 'RETEACH', 'SHOW', 'SWITCH'];

/** Right answers in a row that finish a topic for today, where a next topic exists. */
export const MASTERY_STREAK = 3;

/**
 * The reason on a `SWITCH` made because the child has the topic, not because they are stuck.
 * It travels on the move, so a voice worker can tell a step forward from a step back.
 */
export const MASTERED_TOPIC_REASON = 'The child has this topic today; move on to the next one.';

export function stuckOutcome<TModelContext>(
  context: LoadedTurnContext<TModelContext>,
  reasons: readonly string[],
): PolicyOutcome {
  const stuck = context.session.consecutiveStuck;
  if (stuck >= 2) {
    return moveOnOutcome(context, [...reasons, 'stuck_move_on']);
  }
  if (stuck === 1) {
    return outcome(
      plan('RETEACH', nextApproach(context), 'Still stuck; explain it another way.', context),
      [...reasons, 'second_stuck_turn'],
      { base: STUCK_BASE },
    );
  }
  return outcome(
    plan('HINT', 'single-nudge', 'The child does not know where to start; one nudge.', context),
    [...reasons, 'first_stuck_turn'],
    { base: STUCK_BASE },
  );
}

export function skipOutcome<TModelContext>(
  context: LoadedTurnContext<TModelContext>,
  reason: SkipReason,
): PolicyOutcome {
  if (reason === 'too_easy' && context.session.nextTopic !== null) {
    return nextTopicOutcome(context, 'The child finds this too easy; go to the next topic.', [
      'skip_too_easy',
    ]);
  }
  return moveOnOutcome(context, [`skip_${reason}`]);
}

/** Show the answer, without blame, and let a fresh question follow. */
export function moveOnOutcome<TModelContext>(
  context: LoadedTurnContext<TModelContext>,
  reasons: readonly string[],
): PolicyOutcome {
  return outcome(
    plan('REVEAL', 'move-on', 'Show the answer kindly and go on to a fresh question.', context),
    reasons,
  );
}

/** The topic is done for today; the session moves to the one after it. */
export function nextTopicOutcome<TModelContext>(
  context: LoadedTurnContext<TModelContext>,
  reason: string,
  reasons: readonly string[],
  options?: Parameters<typeof outcome>[2],
): PolicyOutcome {
  return outcome(
    { ...plan('SWITCH', 'next-topic', reason, context), skillCode: context.session.nextTopic },
    reasons,
    options,
  );
}
