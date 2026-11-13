import type { PlannedTurn } from '@aria/tutor';

import type { MustMention } from '@/quality';
import { procedureSteps } from '@/quality/arithmetic';
import { NO_MOVE_INPUTS, type MoveInputs } from '@/services/content/move-inputs/move-inputs.types';
import type { ApiModelContext } from '@/services/content/turn-content.types';

/**
 * A hint that walks a written method one step at a time (P3-07).
 *
 * The policy says which step (`procedureStep` on the plan's evidence); the problem says what
 * that step is. The hint names the step and stops there: it must not say the step's answer
 * and must not say the whole answer, and the gate holds it to both, because a model asked to
 * help with "how many 4s go into 15" will very often just say three.
 */
export function stepHintInputs(turn: PlannedTurn<ApiModelContext>): MoveInputs {
  const problem = turn.context.modelContext.arithmeticProblem;
  const index = turn.plan.evidence?.procedureStep;
  if (turn.plan.approach !== 'point-to-step' || problem === null || typeof index !== 'number') {
    return NO_MOVE_INPUTS;
  }
  const steps = procedureSteps(problem);
  const step = steps[index - 1];
  if (step === undefined) return NO_MOVE_INPUTS;
  const answer = turn.context.modelContext.answerKey;
  return {
    lines: [
      `This is step ${String(index)} of ${String(steps.length)} of the written method: ${step.prompt}`,
      'Point the child at this step only, and ask them to work it out. Do not give its answer, and do not give the final answer.',
    ],
    claims: {
      move: 'hint',
      allowed: [],
      mustNotMention: [
        notSaying(
          'step_answer_given',
          'A step hint points at the step; it does not work it.',
          step.answer,
        ),
        ...(answer === null
          ? []
          : [notSaying('final_answer_given', 'A step hint never gives the whole answer.', answer)]),
      ],
    },
  };
}

function notSaying(code: string, message: string, value: string): MustMention {
  return { code, message, any: [value] };
}
