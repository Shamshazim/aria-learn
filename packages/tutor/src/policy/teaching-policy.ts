import type { TutorInputEvent } from '@aria/shared';

import { allowedSet } from './allowed-set';
import { answerOutcome } from './answer-policy';
import { isDecisive } from './decisive';
import { intentOutcome } from './intent-policy';
import { outcome, plan, type PolicyOutcome } from './outcome';
import { silenceRung } from './silence-ladder';
import { skipOutcome, stuckOutcome } from './stuck-policy';

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
  return (context, event) => toDecision(context, event, decide(input, context, event));
}

/**
 * The allowed set is derived here, once, from what the branch decided and what the session
 * state permits (P2H-06). `decisive` is the planner's off switch: when the reason for the plan
 * is safety, a limit, a ladder rung or a repeated misconception, there is nothing to weigh.
 */
function toDecision<TModelContext>(
  context: LoadedTurnContext<TModelContext>,
  event: TutorInputEvent,
  result: PolicyOutcome,
): PolicyDecision {
  const decisive = result.terminal || isDecisive(result.reasons);
  return {
    allowedMoves: allowedSet({
      event,
      session: context.session,
      defaultPlan: result.plan,
      graded: result.graded,
      decisive,
      base: result.base,
    }),
    defaultPlan: result.plan,
    graded: result.graded,
    terminal: result.terminal,
    decisive,
    reasons: result.reasons,
  };
}

function decide<TModelContext>(
  input: Parameters<typeof createTeachingPolicy<TModelContext>>[0],
  context: LoadedTurnContext<TModelContext>,
  event: TutorInputEvent,
): PolicyOutcome {
  if (
    input.now().getTime() - context.session.startedAt.getTime() >=
    input.sessionLimitMs(context.session.band)
  ) {
    return outcome(
      plan('END', 'wrap-up', 'The age-band session limit was reached.', context),
      ['session_limit'],
      { terminal: true },
    );
  }
  if (event.kind === 'ANSWER' || event.kind === 'SPEECH_FINAL') {
    return utteranceOutcome(input, context, event);
  }
  if (event.kind === 'SILENCE') return silenceOutcome(context);
  // The "I don't get it" button and a spoken "I don't know" climb the same ladder.
  if (event.kind === 'CONFUSED') return stuckOutcome(context, ['event_confused']);
  if (event.kind === 'SKIP') return skipOutcome(context, event.reason);
  return outcome(defaultPlan(context, event), [`event_${event.kind.toLowerCase()}`], {
    terminal: event.kind === 'LEAVE',
  });
}

function utteranceOutcome<TModelContext>(
  input: Parameters<typeof createTeachingPolicy<TModelContext>>[0],
  context: LoadedTurnContext<TModelContext>,
  event: ChildUtterance,
): PolicyOutcome {
  if (event.kind === 'SPEECH_FINAL' && event.confidence !== undefined && event.confidence < 0.75) {
    return outcome(
      plan(
        'SAY',
        'confirm-spoken-answer',
        'The spoken answer was not reliable enough to grade.',
        context,
      ),
      ['low_confidence_speech'],
    );
  }
  const detour = intentOutcome(input.classifyIntent?.(event) ?? 'ANSWER', context);
  if (detour !== null) return detour;
  const graded = input.gradeAnswer(event, context.session.skillCode);
  if (graded === null) {
    return outcome(
      plan('PRAISE', 'completion-evidence', 'The child completed an open response.', context),
      ['completion_only'],
    );
  }
  return answerOutcome(context, graded);
}

/** P2H-01: silence escalates through the ladder instead of repeating one sentence. */
function silenceOutcome<TModelContext>(context: LoadedTurnContext<TModelContext>): PolicyOutcome {
  // The context counts silences already committed; this event is the next one.
  const rung = silenceRung(context.session.consecutiveSilences + 1);
  return outcome(
    {
      ...plan(rung.kind, rung.approach, rung.reason, context),
      evidence: { silenceRung: rung.rung, silenceTerminal: rung.terminal },
    },
    [`silence_rung_${String(rung.rung)}`],
    { terminal: rung.terminal },
  );
}

function defaultPlan<TModelContext>(
  context: LoadedTurnContext<TModelContext>,
  event: TutorInputEvent,
): MovePlan {
  const kind =
    event.kind === 'PAUSE'
      ? 'BREAK'
      : event.kind === 'LEAVE'
        ? 'END'
        : event.kind === 'SUBJECT_CHOSEN' || event.kind === 'RESUME'
          ? 'ASK'
          : 'SAY';
  return plan(kind, 'direct', `Policy for ${event.kind}.`, context);
}
