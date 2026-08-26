import type { TutorMove } from '@aria/shared';
import type { PlannedTurn } from '@aria/tutor';

import type { ApiModelContext, TurnContentDeps } from '@/services/content/turn-content.types';

/**
 * The picture that goes with a reteach, when the reteach said it would show one (P2H-10).
 *
 * The early band is where this is not optional. A five-year-old told "let me show you another
 * way" and then shown nothing has been promised something and given words, and the approach
 * the planner chose was `visual-model` precisely because words had already failed once.
 */
export function visualMove(
  deps: TurnContentDeps,
  turn: PlannedTurn<ApiModelContext>,
): TutorMove | null {
  if (turn.plan.kind !== 'RETEACH' || turn.plan.approach !== 'visual-model') return null;
  if (turn.context.session.band !== 'early') return null;
  const skillCode = turn.plan.skillCode ?? turn.context.session.skillCode;
  if (skillCode === null) return null;
  const visual = deps.visual(skillCode, turn.context.modelContext.arithmeticProblem);
  if (visual === null) return null;
  return deps.moves(turn.context.session.id).make({
    kind: 'SHOW',
    skillId: skillCode,
    speech: null,
    display: [visual],
    expects: 'none',
  });
}
