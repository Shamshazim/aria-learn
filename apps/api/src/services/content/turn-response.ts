import type { MoveKind, TutorInputEvent, TutorMove } from '@aria/shared';
import type { PlannedTurn } from '@aria/tutor';

import { renderLessonGrounding } from '@/ai/prompts/render/lesson.render';
import type { RespondPromptInput } from '@/ai/prompts/types';
import { STRATEGY_CLAIMS } from '@/quality';
import { renderMoveInputs } from '@/services/content/move-inputs';
import type { MoveInputs } from '@/services/content/move-inputs';
import type { ApiModelContext, MoveIdentity } from '@/services/content/turn-content.types';
import type { MoveFactory } from '@/services/moves/move-factory';

/** What the child just said or did, in their own words, for the prompt to react to. */
export function eventText(turn: PlannedTurn<ApiModelContext>): string | undefined {
  const event: TutorInputEvent = turn.event;
  if (event.kind === 'ANSWER') return event.text ?? event.choiceId;
  if (event.kind === 'QUESTION' || event.kind === 'SPEECH_FINAL' || event.kind === 'SPEECH_PARTIAL')
    return event.text;
  return undefined;
}

type MoveFields = (turn: PlannedTurn<ApiModelContext>) => Readonly<Record<string, unknown>>;

/** SAY approaches that step away from the open item and must re-ask it afterwards. */
const DETOUR_APPROACHES: ReadonlySet<string> = new Set([
  'answer-question',
  'acknowledge-chat',
  'reask-short',
  'check-in',
]);

const MOVE_FIELDS: Partial<Readonly<Record<MoveKind, MoveFields>>> = {
  // The arrival moves carry structured fields the schema requires. Without these the turn path
  // throws the moment a planner picks one for an `ARRIVED` event (P2H-03, P2H-06).
  CHECK_IN: () => ({ about: 'difficulty' }),
  RECOMMEND: (turn) => ({
    subjectId: turn.context.session.subject,
    grade: turn.context.session.grade,
    reason: turn.plan.reason,
  }),
  HINT: (turn) => ({ attempt: turn.plan.attempt }),
  RETEACH: (turn) => ({ misconception: turn.decision.graded?.misconception ?? undefined }),
  REVEAL: (turn) => ({ answer: turn.context.modelContext.answerKey ?? 'shown' }),
  // P2H-11: the structured reason names what the grader vouched for, so the recorded move and
  // the spoken sentence agree about what the child actually did.
  PRAISE: (turn) => ({ because: praiseBecause(turn) }),
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

function praiseBecause(turn: PlannedTurn<ApiModelContext>): string {
  const strategy = STRATEGY_CLAIMS.find((claim) =>
    (turn.decision.graded?.strategies ?? []).includes(claim.id),
  );
  if (strategy !== undefined) return `you ${strategy.says}`;
  const answerKey = turn.context.modelContext.answerKey;
  return answerKey === null ? 'you showed your reasoning' : `the answer was ${answerKey}`;
}

export function isDetour(turn: PlannedTurn<ApiModelContext>): boolean {
  return turn.plan.kind === 'SAY' && DETOUR_APPROACHES.has(turn.plan.approach);
}

/**
 * `identity` is set when the move's sentences were already streamed under that id (P2H-07), so
 * the move that finally arrives is recognisably the same one the child has been listening to.
 */
export function responseMove(
  factory: MoveFactory,
  turn: PlannedTurn<ApiModelContext>,
  text: string,
  identity?: MoveIdentity,
): TutorMove {
  const common = {
    kind: turn.plan.kind,
    speech: { text },
    display: [{ type: 'text', body: text, markdown: false }],
    expects: turn.plan.approach === 'confirm-spoken-answer' ? 'speech' : 'none',
    skillId: turn.plan.skillCode ?? undefined,
    ...(identity ?? {}),
  };
  return factory.make({ ...common, ...(MOVE_FIELDS[turn.plan.kind]?.(turn) ?? {}) });
}

/** Builds the persona prompt input for any non-ASK move (P2H-03). */
export function respondInput(
  turn: PlannedTurn<ApiModelContext>,
  inputs: MoveInputs,
): RespondPromptInput {
  const model = turn.context.modelContext;
  const moveInputs = renderMoveInputs(inputs);
  const said = eventText(turn);
  const graded = turn.decision.graded;
  return {
    context: model.scrubbed,
    band: turn.context.session.band,
    move: turn.plan.kind,
    approach: turn.plan.approach,
    subject: turn.context.session.subject,
    ...(turn.context.session.skillCode === null ? {} : { skill: turn.context.session.skillCode }),
    ...(model.lesson === null ? {} : { lesson: renderLessonGrounding(model.lesson) }),
    ...(moveInputs === undefined ? {} : { moveInputs }),
    ...(model.latestQuestion === null ? {} : { question: model.latestQuestion }),
    ...(said === undefined || said === '' ? {} : { learnerSaid: said }),
    ...(model.answerKey === null || turn.plan.kind === 'SAY' ? {} : { answerKey: model.answerKey }),
    ...(graded === null ? {} : { correct: graded.correct }),
  };
}
