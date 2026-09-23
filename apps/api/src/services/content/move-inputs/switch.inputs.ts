import type { PlannedTurn } from '@aria/tutor';

import type { MoveInputs } from '@/services/content/move-inputs/move-inputs.types';
import type { ApiModelContext } from '@/services/content/turn-content.types';

/**
 * Why we are moving on, and to what (P2H-11).
 *
 * A switch that does not say why reads to a child as being given up on. The policy already
 * knows why — attempts, a repeated misconception, silence — so the reason is handed over as a
 * fact rather than left to the model to guess from context it does not have.
 */
export function switchInputs(turn: PlannedTurn<ApiModelContext>): MoveInputs {
  if (turn.plan.approach === 'next-topic') return nextTopicInputs(turn);
  return {
    lines: [
      `Why you are moving on: ${turn.plan.reason}`,
      ...(turn.context.session.consecutiveWrong > 0
        ? [
            'This one has not gone well for a few tries. Say that moving on is your idea, not their failure.',
          ]
        : []),
      ...(turn.context.session.unmetPrerequisite === null
        ? []
        : [
            `What is coming next is the step underneath it: ${turn.context.session.unmetPrerequisite}.`,
          ]),
      ...(turn.context.session.consecutiveSilences > 0
        ? ['The child has gone quiet, so keep this to one sentence and hand them something easy.']
        : []),
    ],
  };
}

/** Forward, not back: the child has this topic today, and the next one is named. */
function nextTopicInputs(turn: PlannedTurn<ApiModelContext>): MoveInputs {
  const said = turn.event.kind === 'ANSWER' ? (turn.event.text ?? turn.event.choiceId) : undefined;
  return {
    lines: [
      `Why you are moving on: ${turn.plan.reason}`,
      ...(said === undefined || said === ''
        ? []
        : [`The child's latest answer, which was right: "${said}".`]),
      `They have answered ${String(turn.context.session.correctStreak + 1)} in a row correctly on this topic.`,
      ...(turn.plan.skillCode === null ? [] : [`What is coming next: ${turn.plan.skillCode}.`]),
      'This is a step forward, not a rescue: say what they did right, then name what is next.',
    ],
  };
}
