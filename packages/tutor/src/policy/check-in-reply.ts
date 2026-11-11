import type { EngagementStateKind, TutorInputEvent } from '@aria/shared';

import { isDenial, readCheckInReply, type CheckInReply } from '../engagement/check-in';

import { changeSubject } from './engagement-policy';
import { outcome, plan, type PolicyOutcome } from './outcome';

import type { LoadedTurnContext, MovePlan } from '../types';

/**
 * The child's answer to a check-in Aria asked (P3-05). Never graded: "an easy one" is not a
 * wrong answer to "what is seven and five".
 *
 * "Stop" stops. "Keep going" or "I'm fine" means Aria guessed wrong: the state is cleared,
 * logged as a false positive, and not asked about again this session. Anything that is not
 * one of the two answers offered is `null`, and the turn goes on as it otherwise would.
 */
export function checkInReplyOutcome<TModelContext>(
  context: LoadedTurnContext<TModelContext>,
  event: TutorInputEvent,
): PolicyOutcome | null {
  const open = context.session.engagement?.openCheckIn ?? null;
  if (open === null || open.state === 'ready') return null;
  if (event.kind !== 'ANSWER' && event.kind !== 'SPEECH_FINAL') return null;
  if (event.kind === 'ANSWER' && event.respondsTo !== open.moveId) return null;
  const reply = readCheckInReply(open.state, {
    choiceId: event.kind === 'ANSWER' ? event.choiceId : undefined,
    text: event.text,
  });
  if (reply === null) return null;
  return replyOutcome(context, open.state, reply);
}

function replyOutcome<TModelContext>(
  context: LoadedTurnContext<TModelContext>,
  state: Exclude<EngagementStateKind, 'ready'>,
  reply: CheckInReply,
): PolicyOutcome {
  const denied = isDenial(reply);
  const evidence = {
    engagementChanged: true,
    engagementState: denied ? 'ready' : state,
    engagementConfidence: denied ? 0 : 0.9,
    engagementSignals: denied ? 'said_fine' : 'check_in_reply',
    engagementDecision: `reply_${reply}`,
    engagementReply: reply,
    ...(denied ? { engagementDenied: state, engagementFalsePositive: true } : {}),
  };
  const planned = replyPlan(context, reply);
  return outcome(
    { ...planned, evidence: { ...planned.evidence, ...evidence } },
    ['engagement_reply', ...(reply === 'stop' ? ['stop_request'] : [])],
    { terminal: reply === 'stop' },
  );
}

function replyPlan<TModelContext>(
  context: LoadedTurnContext<TModelContext>,
  reply: CheckInReply,
): MovePlan {
  const why = `The child answered the check-in: ${reply}.`;
  switch (reply) {
    case 'stop':
      return plan('BREAK', 'child_asked', why, context);
    case 'break':
      return plan('BREAK', 'attention', why, context);
    case 'easy':
      return plan('ASK', 'easier-item', why, context);
    case 'switch':
      return changeSubject(context, why);
    case 'help':
      return plan('RETEACH', 'simpler-case', why, context);
    default:
      return plan('ASK', 'same-item', why, context);
  }
}
