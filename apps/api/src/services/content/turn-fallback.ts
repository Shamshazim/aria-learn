import type { TutorInputEvent } from '@aria/shared';
import type { PlannedTurn } from '@aria/tutor';

import type { ApiModelContext } from '@/services/content/turn-content.service';

export function fallbackText(turn: PlannedTurn<ApiModelContext>): string {
  switch (turn.plan.kind) {
    case 'HINT':
      return 'Look and try again.';
    case 'RETEACH':
      return turn.plan.approach === 'visual-model'
        ? 'Look. We can show a different way.'
        : 'We can try a different way.';
    case 'REVEAL':
      return `The answer is ${turn.context.modelContext.answerKey ?? 'shown'}.`;
    case 'PRAISE':
      return praiseText(turn.context.modelContext.answerKey);
    case 'BREAK':
      return 'We can stop for today.';
    case 'END':
      return 'You learned and kept trying.';
    case 'LISTEN':
      return 'Take your time. I am ready.';
    case 'SAY':
      return 'I can help. Let us look together.';
    case 'SWITCH':
      return 'Let us try a different step.';
    default:
      return 'Let us try one step.';
  }
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
