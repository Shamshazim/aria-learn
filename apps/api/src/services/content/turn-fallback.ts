import type { TutorInputEvent } from '@aria/shared';
import type { PlannedTurn } from '@aria/tutor';

import type { ApiModelContext } from '@/services/content/turn-content.service';

export function fallbackText(turn: PlannedTurn<ApiModelContext>): string {
  if (turn.plan.kind === 'RETEACH') return reteachText(turn.plan.approach);
  if (turn.plan.kind === 'REVEAL')
    return `The answer is ${turn.context.modelContext.answerKey ?? 'shown'}.`;
  if (turn.plan.kind === 'PRAISE') return praiseText(turn.context.modelContext.answerKey);
  if (turn.plan.kind === 'SAY') return sayText(turn.plan.approach);
  return STATIC_FALLBACKS[turn.plan.kind] ?? 'Let us try one step.';
}

export function eventText(turn: PlannedTurn<ApiModelContext>): string | undefined {
  const event: TutorInputEvent = turn.event;
  if (event.kind === 'ANSWER') return event.text ?? event.choiceId;
  if (event.kind === 'QUESTION' || event.kind === 'SPEECH_FINAL' || event.kind === 'SPEECH_PARTIAL')
    return event.text;
  return undefined;
}

function praiseText(answerKey: string | null): string {
  return answerKey === null ? 'Yes. You showed your idea.' : `Yes. ${answerKey} is right.`;
}

const STATIC_FALLBACKS: Readonly<Record<string, string>> = {
  HINT: 'Look and try again.',
  BREAK: 'We can stop for today.',
  END: 'You learned and kept trying.',
  LISTEN: 'Take your time. I am ready.',
  SWITCH: 'Let us try a different step.',
};

function reteachText(approach: string): string {
  return approach === 'visual-model'
    ? 'Look. We can show a different way.'
    : 'We can try a different way.';
}

const SAY_FALLBACKS: Readonly<Record<string, string>> = {
  'confirm-spoken-answer': 'I did not catch that. Can you say it again?',
  'answer-question': 'Good thinking to ask. We can find out together as we go.',
  'acknowledge-chat': 'Thanks for telling me. Now back to our question.',
  'reask-short': 'No rush. What do you think the answer is?',
  'check-in': 'Are you still there? Say or tap something so I know.',
};

function sayText(approach: string): string {
  return SAY_FALLBACKS[approach] ?? 'I can help. We can look at it together.';
}
