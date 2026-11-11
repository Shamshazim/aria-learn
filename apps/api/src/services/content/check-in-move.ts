import { ENGAGEMENT_STATES, type EngagementStateKind } from '@aria/shared';
import { checkInCopy, type PlannedTurn, type ResolvedContent } from '@aria/tutor';

import { requiredGatedText } from '@/services/content/generate-text';
import type { ApiModelContext, TurnContentDeps } from '@/services/content/turn-content.types';

const PREFIX = 'engagement-';

/**
 * P3-05: a check-in about how the child is doing, in reviewed words, with its two answers.
 *
 * No model writes this. The copy lives in `@aria/tutor` beside the rule that it is only ever
 * a question; here it is put through the gate like any child-facing text and shown as two
 * choices, which the early band renders as two big buttons and every band can answer aloud.
 * `null` for any turn that is not an engagement check-in.
 */
export function engagementCheckIn(
  deps: TurnContentDeps,
  turn: PlannedTurn<ApiModelContext>,
): ResolvedContent | null {
  const state = checkInState(turn);
  if (state === null) return null;
  const band = turn.context.session.band;
  const copy = checkInCopy(state, band);
  const text = requiredGatedText(deps.gate, copy.text, band);
  const move = deps.moves(turn.context.session.id).make({
    kind: 'CHECK_IN',
    about: copy.about,
    speech: { text },
    display: [
      { type: 'text', body: text, markdown: false },
      { type: 'choices', options: copy.options.map((option) => ({ ...option })) },
    ],
    expects: 'choice',
  });
  return { moves: [move], privateEvidence: { responseSource: 'reviewed-fixed', checkIn: state } };
}

function checkInState(
  turn: PlannedTurn<ApiModelContext>,
): Exclude<EngagementStateKind, 'ready'> | null {
  if (turn.plan.kind !== 'CHECK_IN' || !turn.plan.approach.startsWith(PREFIX)) return null;
  const named = turn.plan.approach.slice(PREFIX.length);
  const state = ENGAGEMENT_STATES.find((candidate) => candidate === named);
  return state === undefined || state === 'ready' ? null : state;
}
