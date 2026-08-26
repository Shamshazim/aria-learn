import type { TutorMove } from '@aria/shared';
import type { PlannedTurn } from '@aria/tutor';

import type { ApiModelContext, TurnContentDeps } from '@/services/content/turn-content.types';

/**
 * The picture that goes with a reteach, when the reteach said it would show one (P2H-10).
 *
 * A child told "let me show you another way" and then shown nothing has been promised
 * something and given words, and the approach was `visual-model` precisely because words had
 * already failed once. The early band is where it matters most and the rule is not band-bound:
 * every maths skill declares its kinds, so every band that reteaches visually gets a picture.
 *
 * The caption comes from the misconception being reteached where there is one, so the picture
 * addresses the specific wrong idea rather than the skill in general.
 */
export function visualMove(
  deps: TurnContentDeps,
  turn: PlannedTurn<ApiModelContext>,
): TutorMove | null {
  if (turn.plan.kind !== 'RETEACH' || turn.plan.approach !== 'visual-model') return null;
  const skillCode = turn.plan.skillCode ?? turn.context.session.skillCode;
  if (skillCode === null) return null;
  const visual = deps.visual({
    skillCode,
    problem: turn.context.modelContext.arithmeticProblem,
    misconceptionId:
      turn.decision.graded?.misconception ?? turn.context.session.repeatedMisconception,
  });
  if (visual === null) return null;
  return deps.moves(turn.context.session.id).make({
    kind: 'SHOW',
    skillId: skillCode,
    speech: null,
    display: [visual],
    expects: 'none',
  });
}
