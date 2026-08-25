import type { MoveKind, TutorMove } from '@aria/shared';
import type { PlannedTurn } from '@aria/tutor';

import type { RespondPromptInput } from '@/ai/prompts/types';
import type { ApiModelContext } from '@/services/content/turn-content.service';
import { eventText } from '@/services/content/turn-fallback';
import type { MoveFactory } from '@/services/moves/move-factory';

type MoveFields = (turn: PlannedTurn<ApiModelContext>) => Readonly<Record<string, unknown>>;

/** SAY approaches that step away from the open item and must re-ask it afterwards. */
const DETOUR_APPROACHES: ReadonlySet<string> = new Set([
  'answer-question',
  'acknowledge-chat',
  'reask-short',
  'check-in',
]);

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
  BREAK: (turn) => ({
    reason:
      turn.plan.approach === 'attention' || turn.plan.approach === 'child_asked'
        ? turn.plan.approach
        : 'time_limit',
  }),
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

export function isDetour(turn: PlannedTurn<ApiModelContext>): boolean {
  return turn.plan.kind === 'SAY' && DETOUR_APPROACHES.has(turn.plan.approach);
}

export function responseMove(
  factory: MoveFactory,
  turn: PlannedTurn<ApiModelContext>,
  text: string,
): TutorMove {
  const common = {
    kind: turn.plan.kind,
    speech: { text },
    display: [{ type: 'text', body: text, markdown: false }],
    expects: turn.plan.approach === 'confirm-spoken-answer' ? 'speech' : 'none',
    skillId: turn.plan.skillCode ?? undefined,
  };
  return factory.make({ ...common, ...(MOVE_FIELDS[turn.plan.kind]?.(turn) ?? {}) });
}

/** Builds the persona prompt input for any non-ASK move (P2H-03). */
export function respondInput(turn: PlannedTurn<ApiModelContext>): RespondPromptInput {
  const model = turn.context.modelContext;
  const said = eventText(turn);
  const graded = turn.decision.graded;
  return {
    context: model.scrubbed,
    band: turn.context.session.band,
    move: turn.plan.kind,
    approach: turn.plan.approach,
    subject: turn.context.session.subject,
    ...(turn.context.session.skillCode === null ? {} : { skill: turn.context.session.skillCode }),
    ...(model.latestQuestion === null ? {} : { question: model.latestQuestion }),
    ...(said === undefined || said === '' ? {} : { learnerSaid: said }),
    ...(model.answerKey === null || turn.plan.kind === 'SAY' ? {} : { answerKey: model.answerKey }),
    ...(graded === null ? {} : { correct: graded.correct }),
  };
}
