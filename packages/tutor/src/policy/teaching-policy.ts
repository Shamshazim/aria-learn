import type { MoveKind, TutorInputEvent } from '@aria/shared';

import type { LoadedTurnContext, MovePlan, PolicyDecision } from '../types';

export type AnswerGrader = (
  event: Extract<TutorInputEvent, { kind: 'ANSWER' | 'SPEECH_FINAL' }>,
  skillCode: string | null,
) => Readonly<{ correct: boolean; misconception: string | null }> | null;

export function createTeachingPolicy<TModelContext>(input: {
  gradeAnswer: AnswerGrader;
  sessionLimitMs(band: LoadedTurnContext<TModelContext>['session']['band']): number;
  now(): Date;
}): (context: LoadedTurnContext<TModelContext>, event: TutorInputEvent) => PolicyDecision {
  return (context, event) => decide(input, context, event);
}

function decide<TModelContext>(
  input: Parameters<typeof createTeachingPolicy<TModelContext>>[0],
  context: LoadedTurnContext<TModelContext>,
  event: TutorInputEvent,
): PolicyDecision {
  if (
    input.now().getTime() - context.session.startedAt.getTime() >=
    input.sessionLimitMs(context.session.band)
  ) {
    return decision(
      plan('END', 'wrap-up', 'The age-band session limit was reached.', context),
      null,
      true,
    );
  }
  if (event.kind === 'ANSWER' || event.kind === 'SPEECH_FINAL') {
    const graded = input.gradeAnswer(event, context.session.skillCode);
    if (graded === null) {
      return decision(
        plan('PRAISE', 'completion-evidence', 'The child completed an open response.', context),
        null,
        false,
      );
    }
    return answerDecision(context, graded);
  }
  return decision(defaultPlan(context, event), null, event.kind === 'LEAVE');
}

function answerDecision<TModelContext>(
  context: LoadedTurnContext<TModelContext>,
  graded: Readonly<{ correct: boolean; misconception: string | null }>,
): PolicyDecision {
  if (graded.correct) return correctDecision(context, graded);
  if (context.session.consecutiveWrong >= 3 && context.session.unmetPrerequisite !== null) {
    return decision(
      {
        ...plan(
          'SWITCH',
          'prerequisite-step',
          'The current skill is stuck; return to its unmet prerequisite.',
          context,
        ),
        skillCode: context.session.unmetPrerequisite,
      },
      graded,
      false,
    );
  }
  if (context.session.consecutiveWrong >= 2) {
    return decision(
      plan('REVEAL', 'worked-example', 'Productive struggle is over.', context),
      graded,
      false,
    );
  }
  if (
    graded.misconception !== null &&
    graded.misconception === context.session.repeatedMisconception
  ) {
    return decision(
      plan(
        'RETEACH',
        'misconception-fix',
        'This misconception was seen before; use its recorded fix.',
        context,
      ),
      graded,
      false,
    );
  }
  if (context.session.consecutiveWrong === 1) {
    return decision(
      plan('RETEACH', nextApproach(context), 'The prior approach did not work.', context),
      graded,
      false,
    );
  }
  return decision(
    plan('HINT', 'single-nudge', 'This is the first incorrect attempt.', context),
    graded,
    false,
  );
}

function correctDecision<TModelContext>(
  context: LoadedTurnContext<TModelContext>,
  graded: Readonly<{ correct: boolean; misconception: string | null }>,
): PolicyDecision {
  return decision(
    plan('PRAISE', 'specific-evidence', 'The answer was correct.', context),
    graded,
    false,
  );
}

function defaultPlan<TModelContext>(
  context: LoadedTurnContext<TModelContext>,
  event: TutorInputEvent,
): MovePlan {
  const kind: MoveKind =
    event.kind === 'CONFUSED'
      ? 'RETEACH'
      : event.kind === 'PAUSE'
        ? 'BREAK'
        : event.kind === 'LEAVE'
          ? 'END'
          : event.kind === 'SILENCE'
            ? 'LISTEN'
            : event.kind === 'SUBJECT_CHOSEN' || event.kind === 'RESUME'
              ? 'ASK'
              : 'SAY';
  return plan(
    kind,
    event.kind === 'CONFUSED' ? nextApproach(context) : 'direct',
    `Policy for ${event.kind}.`,
    context,
  );
}

function nextApproach<TModelContext>(context: LoadedTurnContext<TModelContext>): string {
  return context.session.lastApproach === 'visual-model' ? 'worked-example' : 'visual-model';
}

function plan<TModelContext>(
  kind: MoveKind,
  approach: string,
  reason: string,
  context: LoadedTurnContext<TModelContext>,
): MovePlan {
  return {
    kind,
    approach,
    reason,
    skillCode: context.session.skillCode,
    attempt: Math.min(10, context.session.consecutiveWrong + 1),
  };
}

function decision(
  defaultPlan: MovePlan,
  graded: PolicyDecision['graded'],
  terminal: boolean,
): PolicyDecision {
  return { allowedMoves: allowedMovesForKind(defaultPlan.kind), defaultPlan, graded, terminal };
}

function allowedMovesForKind(kind: MoveKind): readonly MoveKind[] {
  if (kind === 'END') return ['END'];
  return [kind];
}
