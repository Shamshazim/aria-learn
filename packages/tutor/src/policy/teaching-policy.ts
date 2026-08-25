import type { MoveKind, TutorInputEvent } from '@aria/shared';

import { silenceRung } from './silence-ladder';

import type { Intent } from '../intent/intent.types';
import type { LoadedTurnContext, MovePlan, PolicyDecision } from '../types';

type ChildUtterance = Extract<TutorInputEvent, { kind: 'ANSWER' | 'SPEECH_FINAL' }>;

export type AnswerGrader = (
  event: ChildUtterance,
  skillCode: string | null,
) => Readonly<{ correct: boolean; misconception: string | null }> | null;

/** Returns what kind of thing the child said; `null` means "treat it as an answer". */
export type IntentClassifier = (event: ChildUtterance) => Intent | null;

export function createTeachingPolicy<TModelContext>(input: {
  gradeAnswer: AnswerGrader;
  classifyIntent?: IntentClassifier;
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
    if (
      event.kind === 'SPEECH_FINAL' &&
      event.confidence !== undefined &&
      event.confidence < 0.75
    ) {
      return decision(
        plan(
          'SAY',
          'confirm-spoken-answer',
          'The spoken answer was not reliable enough to grade.',
          context,
        ),
        null,
        false,
      );
    }
    const detour = intentDecision(input.classifyIntent?.(event) ?? 'ANSWER', context);
    if (detour !== null) return detour;
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
  if (event.kind === 'SILENCE') return silenceDecision(context);
  return decision(defaultPlan(context, event), null, event.kind === 'LEAVE');
}

/** P2H-05: a question, a bit of chat, confusion or "stop" is never graded as a wrong answer. */
function intentDecision<TModelContext>(
  intent: Intent,
  context: LoadedTurnContext<TModelContext>,
): PolicyDecision | null {
  if (intent === 'ANSWER') return null;
  if (intent === 'STOP_REQUEST') {
    return decision(
      plan('BREAK', 'child_asked', 'Intent STOP_REQUEST: the child asked to stop.', context),
      null,
      true,
    );
  }
  if (intent === 'PERSONAL_INFO') {
    // Fixed reviewed text, no model call, nothing stored. The child gets one warm sentence
    // and the lesson back; the words they said do not travel anywhere.
    return decision(
      {
        ...plan(
          'SAY',
          'deflect-personal-info',
          'Intent PERSONAL_INFO: deflect warmly and return to the item.',
          context,
        ),
        evidence: { personalInfoRedacted: true },
      },
      null,
      false,
    );
  }
  if (intent === 'UNCLEAR') {
    return decision(
      plan(
        'SAY',
        'confirm-spoken-answer',
        'Intent UNCLEAR: ask the child to say it again.',
        context,
      ),
      null,
      false,
    );
  }
  if (intent === 'CONFUSED') {
    return decision(
      plan('RETEACH', nextApproach(context), 'Intent CONFUSED: explain another way.', context),
      null,
      false,
    );
  }
  const approach = intent === 'QUESTION' ? 'answer-question' : 'acknowledge-chat';
  return decision(
    plan('SAY', approach, `Intent ${intent}: respond briefly, then return to the item.`, context),
    null,
    false,
  );
}

/** P2H-01: silence escalates through the ladder instead of repeating one sentence. */
function silenceDecision<TModelContext>(context: LoadedTurnContext<TModelContext>): PolicyDecision {
  // The context counts silences already committed; this event is the next one.
  const rung = silenceRung(context.session.consecutiveSilences + 1);
  const chosen = {
    ...plan(rung.kind, rung.approach, rung.reason, context),
    evidence: { silenceRung: rung.rung, silenceTerminal: rung.terminal },
  };
  return decision(chosen, null, rung.terminal);
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
