import type { MoveKind, TutorMove } from '@aria/shared';
import type { PlannedTurn } from '@aria/tutor';

import type { ApiModelContext } from '@/services/content/turn-content.service';
import type { MoveFactory } from '@/services/moves/move-factory';

type MoveFields = (turn: PlannedTurn<ApiModelContext>) => Readonly<Record<string, unknown>>;

const MOVE_FIELDS: Partial<Readonly<Record<MoveKind, MoveFields>>> = {
  HINT: (turn) => ({ attempt: turn.plan.attempt }),
  RETEACH: (turn) => ({ misconception: turn.decision.graded?.misconception ?? undefined }),
  REVEAL: (turn) => ({ answer: turn.context.modelContext.answerKey ?? 'shown' }),
  PRAISE: (turn) => ({
    because:
      turn.context.modelContext.answerKey === null
        ? 'you showed your reasoning'
        : `the answer was ${turn.context.modelContext.answerKey}`,
  }),
  BREAK: () => ({ reason: 'time_limit' }),
  END: (turn) => ({
    learned: [turn.plan.skillCode ?? turn.context.session.subject],
    reason:
      turn.event.kind === 'LEAVE'
        ? 'child_left'
        : turn.plan.reason === 'The age-band session limit was reached.'
          ? 'time_limit'
          : 'complete',
  }),
  LISTEN: () => ({ purpose: 'answer', expects: 'speech' }),
  SWITCH: (turn) => ({ reason: turn.plan.reason }),
};

export function responseMove(
  factory: MoveFactory,
  turn: PlannedTurn<ApiModelContext>,
  text: string,
): TutorMove {
  const common = {
    kind: turn.plan.kind,
    speech: { text },
    display: [{ type: 'text', body: text, markdown: false }],
    expects: 'none',
    skillId: turn.plan.skillCode ?? undefined,
  };
  return factory.make({ ...common, ...(MOVE_FIELDS[turn.plan.kind]?.(turn) ?? {}) });
}
