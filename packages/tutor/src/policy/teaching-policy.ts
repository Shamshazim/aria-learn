import type { TutorInputEvent } from '@aria/shared';

import { utteranceStatement } from '../engagement/event-signals';
import { selfCorrection } from '../intent/self-correction';
import {
  forbiddenAfterStuck,
  neverStuckTwice,
  STUCK_TWICE_EVENT,
  STUCK_TWICE_REASON,
} from '../scheduler/invariant';

import { allowedSet } from './allowed-set';
import { answerOutcome } from './answer-policy';
import { checkInReplyOutcome } from './check-in-reply';
import { isDecisive } from './decisive';
import { statementOutcome, withEngagement } from './engagement-policy';
import { intentOutcome } from './intent-policy';
import { nextApproach, outcome, plan, type PolicyOutcome } from './outcome';
import { selfCorrectionOutcome } from './self-correction-policy';
import { silenceRung } from './silence-ladder';
import { skipOutcome, stuckOutcome } from './stuck-policy';

import type { Intent } from '../intent/intent.types';
import type { LoadedTurnContext, MovePlan, PolicyDecision } from '../types';

type ChildUtterance = Extract<TutorInputEvent, { kind: 'ANSWER' | 'SPEECH_FINAL' }>;

/**
 * P3-06: what may carry a self-correction. A stop, personal information or an unclear
 * utterance is handled as itself first — "I don't want maths anymore, stop" is a stop.
 */
const CORRECTABLE: ReadonlySet<Intent> = new Set(['ANSWER', 'CHAT', 'QUESTION']);

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
  return (context, event) => toDecision(context, event, engaged(input, context, event));
}

/**
 * P3-05: the turn's own decision, then the child's reply to an open check-in, then the
 * engagement state's say. Anything terminal — the time limit, a stop — stands as it is.
 */
function engaged<TModelContext>(
  input: Parameters<typeof createTeachingPolicy<TModelContext>>[0],
  context: LoadedTurnContext<TModelContext>,
  event: TutorInputEvent,
): PolicyOutcome {
  const base = decide(input, context, event);
  if (base.terminal) return base;
  return checkInReplyOutcome(context, event) ?? withEngagement(context, event, base, input.now());
}

/**
 * The allowed set is derived here, once, from what the branch decided and what the session
 * state permits (P2H-06). `decisive` is the planner's off switch: when the reason for the plan
 * is safety, a limit, a ladder rung or a repeated misconception, there is nothing to weigh.
 *
 * The stuck-twice invariant (P3-04) runs last, over every branch, and takes its forbidden
 * moves out of the planner's set as well as out of the plan: a rule only the default plan obeys
 * is a rule the planner can break.
 */
function toDecision<TModelContext>(
  context: LoadedTurnContext<TModelContext>,
  event: TutorInputEvent,
  decided: PolicyOutcome,
): PolicyDecision {
  const forbidden = decided.terminal ? [] : forbiddenAfterStuck(stuckInput(context, decided));
  const result = decided.terminal ? decided : enforceStuckTwice(context, decided);
  const decisive = result.terminal || isDecisive(result.reasons);
  const allowed = allowedSet({
    event,
    session: context.session,
    defaultPlan: result.plan,
    graded: result.graded,
    decisive,
    base: result.base,
  }).filter((kind) => kind === result.plan.kind || !forbidden.includes(kind));
  return {
    allowedMoves: allowed,
    defaultPlan: result.plan,
    graded: result.graded,
    terminal: result.terminal,
    decisive,
    reasons: result.reasons,
  };
}

function stuckInput<TModelContext>(
  context: LoadedTurnContext<TModelContext>,
  decided: PolicyOutcome,
): Parameters<typeof forbiddenAfterStuck>[0] {
  const before = context.session.wrongOnSkill ?? context.session.consecutiveWrong;
  const correct = decided.graded?.correct;
  return {
    wrongOnSkill: correct === true ? 0 : before + (correct === false ? 1 : 0),
    stuckOnItem: context.session.consecutiveStuck,
  };
}

/**
 * Rewrites a plan the invariant forbids: back a step when there is a weak prerequisite, and
 * otherwise the idea explained another way. Either is a change; asking again is not.
 */
function enforceStuckTwice<TModelContext>(
  context: LoadedTurnContext<TModelContext>,
  decided: PolicyOutcome,
): PolicyOutcome {
  const forced = neverStuckTwice({ ...stuckInput(context, decided), kind: decided.plan.kind });
  if (forced === null) return decided;
  const prerequisite = context.session.unmetPrerequisite;
  const rewritten =
    prerequisite === null
      ? plan(forced.kind, nextApproach(context), forced.reason, context)
      : { ...plan('SWITCH', 'prerequisite-step', forced.reason, context), skillCode: prerequisite };
  return outcome(
    {
      ...rewritten,
      evidence: {
        ...decided.plan.evidence,
        invariant: STUCK_TWICE_EVENT,
        rewrote: decided.plan.kind,
      },
    },
    [...decided.reasons, STUCK_TWICE_REASON],
    { graded: decided.graded },
  );
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
  const intent = input.classifyIntent?.(event) ?? 'ANSWER';
  const correction = CORRECTABLE.has(intent) ? selfCorrection(event.text ?? '') : null;
  if (correction !== null) return selfCorrectionOutcome(context, correction);
  const detour = intentOutcome(intent, context);
  if (detour !== null) return detour;
  if (utteranceStatement(event) !== null) return statementOutcome(context);
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
