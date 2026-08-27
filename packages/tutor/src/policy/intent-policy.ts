import { nextApproach, outcome, plan, type PolicyOutcome } from './outcome';

import type { Intent } from '../intent/intent.types';
import type { LoadedTurnContext } from '../types';

/** P2H-05: a question, a bit of chat, confusion or "stop" is never graded as a wrong answer. */
export function intentOutcome<TModelContext>(
  intent: Intent,
  context: LoadedTurnContext<TModelContext>,
): PolicyOutcome | null {
  const result = classified(intent, context);
  return result === null ? null : recordIntent(result, intent);
}

/**
 * P2H-06: the intent is written to the turn's evidence, so the next turn's planner can be told
 * what the child has been doing rather than which protocol events went past.
 */
function recordIntent(result: PolicyOutcome, intent: Intent): PolicyOutcome {
  return { ...result, plan: { ...result.plan, evidence: { ...result.plan.evidence, intent } } };
}

function classified<TModelContext>(
  intent: Intent,
  context: LoadedTurnContext<TModelContext>,
): PolicyOutcome | null {
  if (intent === 'ANSWER') return null;
  if (intent === 'STOP_REQUEST') {
    return outcome(
      plan('BREAK', 'child_asked', 'Intent STOP_REQUEST: the child asked to stop.', context),
      ['stop_request'],
      { terminal: true },
    );
  }
  if (intent === 'PERSONAL_INFO') return personalInfoOutcome(context);
  if (intent === 'UNCLEAR') {
    return outcome(
      plan(
        'SAY',
        'confirm-spoken-answer',
        'Intent UNCLEAR: ask the child to say it again.',
        context,
      ),
      ['unclear'],
    );
  }
  if (intent === 'CONFUSED') {
    return outcome(
      plan('RETEACH', nextApproach(context), 'Intent CONFUSED: explain another way.', context),
      ['intent_confused'],
      { base: ['RETEACH', 'SHOW', 'SWITCH'] },
    );
  }
  return conversationOutcome(intent, context);
}

function conversationOutcome<TModelContext>(
  intent: Extract<Intent, 'QUESTION' | 'CHAT'>,
  context: LoadedTurnContext<TModelContext>,
): PolicyOutcome {
  const question = intent === 'QUESTION';
  return outcome(
    plan(
      'SAY',
      question ? 'answer-question' : 'acknowledge-chat',
      `Intent ${intent}: respond briefly, then return to the item.`,
      context,
    ),
    [question ? 'intent_question' : 'intent_chat'],
    { base: question ? ['SAY', 'SHOW', 'ASK'] : ['SAY', 'ASK'] },
  );
}

/**
 * Fixed reviewed text, no model call, nothing stored. The child gets one warm sentence and the
 * lesson back; the words they said do not travel anywhere — including to a planner.
 */
function personalInfoOutcome<TModelContext>(
  context: LoadedTurnContext<TModelContext>,
): PolicyOutcome {
  return outcome(
    {
      ...plan(
        'SAY',
        'deflect-personal-info',
        'Intent PERSONAL_INFO: deflect warmly and return to the item.',
        context,
      ),
      evidence: { personalInfoRedacted: true },
    },
    ['personal_info'],
  );
}
