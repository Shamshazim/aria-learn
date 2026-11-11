import type { TutorInputEvent } from '@aria/shared';

import { adapt } from '../engagement/adaptation';
import { fold } from '../engagement/estimator';
import { eventSignals, gradedSignals, utteranceStatement } from '../engagement/event-signals';
import { EMPTY_HISTORY } from '../engagement/types';

import { isDecisive } from './decisive';
import { outcome, plan, type PolicyOutcome } from './outcome';

import type { AdaptationDecision, EngagementSignal, EngagementState } from '../engagement/types';
import type { LoadedTurnContext, MovePlan } from '../types';

/** An engagement event that changed nothing a child would see: record it, say nothing. */
export const ENGAGEMENT_NOTED = 'engagement_noted';

/** The events a turn may adapt on. A silence has its own ladder; a question is answered first. */
const ADAPTABLE: ReadonlySet<TutorInputEvent['kind']> = new Set([
  'ANSWER',
  'SPEECH_FINAL',
  'CONFUSED',
  'ENGAGEMENT_SIGNAL',
  'RESUME',
]);

/**
 * P3-05: the session's engagement state, folded from its evidence and this turn's, and — when
 * it is confident enough and nothing more important is happening — the response to it.
 *
 * What stands: anything terminal or decisive (a stop, a limit, personal information, a ladder
 * rung), and praise for a right answer. A check-in or an adaptation otherwise replaces the
 * plan; the graded result is kept, so the answer still counts.
 */
export function withEngagement<TModelContext>(
  context: LoadedTurnContext<TModelContext>,
  event: TutorInputEvent,
  base: PolicyOutcome,
  now: Date,
): PolicyOutcome {
  const engagement = context.session.engagement;
  const history = engagement?.history ?? EMPTY_HISTORY;
  const signals = [...(engagement?.signals ?? []), ...currentSignals(context, event, base)];
  const state = fold({ signals, now, denied: history.denied });
  const decision = adapt(state, history);
  const evidence = engagementEvidence(context, state, decision);
  if (decision.kind !== 'none' && adaptable(event, base)) {
    return adaptation(context, decision, base, evidence);
  }
  if (event.kind === 'ENGAGEMENT_SIGNAL') {
    return outcome(
      {
        ...plan('SAY', 'engagement-noted', 'An engagement signal that needs no move.', context),
        evidence,
      },
      [ENGAGEMENT_NOTED],
    );
  }
  return Object.keys(evidence).length === 0
    ? base
    : { ...base, plan: { ...base.plan, evidence: { ...base.plan.evidence, ...evidence } } };
}

/** A sentence about the child is not an answer, and is never graded as one. */
export function statementOutcome<TModelContext>(
  context: LoadedTurnContext<TModelContext>,
): PolicyOutcome {
  return outcome(
    plan('SAY', 'acknowledge-chat', 'The child said how they are; listen, then go on.', context),
    ['engagement_statement'],
    { base: ['SAY', 'ASK'] },
  );
}

function currentSignals<TModelContext>(
  context: LoadedTurnContext<TModelContext>,
  event: TutorInputEvent,
  base: PolicyOutcome,
): readonly EngagementSignal[] {
  const { band, consecutiveWrong } = context.session;
  const setting = context.session.engagement?.current ?? { expects: null, openQuestion: false };
  const passive = eventSignals(event, { band, ...setting });
  const statement = utteranceStatement(event);
  const slow = passive.some((signal) => signal.name === 'latency_slow');
  const graded =
    base.graded === null
      ? []
      : gradedSignals(base.graded, {
          band,
          wrongBefore: consecutiveWrong,
          slow,
          at: new Date(event.at),
        });
  return [...passive, ...(statement === null ? [] : [statement]), ...graded];
}

function adaptable(event: TutorInputEvent, base: PolicyOutcome): boolean {
  return (
    ADAPTABLE.has(event.kind) &&
    !base.terminal &&
    !isDecisive(base.reasons) &&
    base.graded?.correct !== true
  );
}

type Evidence = Readonly<Record<string, number | string | boolean>>;

/** Written only when something changed, so the log has one row per inference, not per turn. */
function engagementEvidence<TModelContext>(
  context: LoadedTurnContext<TModelContext>,
  state: EngagementState,
  decision: AdaptationDecision,
): Evidence {
  const previous = context.session.engagement?.previous ?? null;
  const unchanged =
    decision.kind === 'none' &&
    (previous === null
      ? state.kind === 'ready'
      : previous.kind === state.kind && previous.confidence === state.confidence);
  if (unchanged) return {};
  return {
    engagementChanged: true,
    engagementState: state.kind,
    engagementConfidence: state.confidence,
    engagementSignals: state.evidence.map((signal) => signal.name).join(','),
    engagementDecision: decision.kind,
    ...(decision.escalated ? { engagementEscalated: true } : {}),
  };
}

function adaptation<TModelContext>(
  context: LoadedTurnContext<TModelContext>,
  decision: AdaptationDecision,
  base: PolicyOutcome,
  evidence: Evidence,
): PolicyOutcome {
  const planned = adaptationPlan(context, decision);
  const reasons = decision.kind === 'check_in' ? ['engagement_check_in'] : ['engagement_adapt'];
  return outcome(
    { ...planned, evidence: { ...base.plan.evidence, ...planned.evidence, ...evidence } },
    [...reasons, `engagement_${decision.kind}`],
    { graded: base.graded },
  );
}

function adaptationPlan<TModelContext>(
  context: LoadedTurnContext<TModelContext>,
  decision: AdaptationDecision,
): MovePlan {
  const why = `Engagement ${decision.state} at ${String(decision.confidence)}: ${decision.kind}.`;
  switch (decision.kind) {
    case 'check_in':
      return {
        ...plan('CHECK_IN', `engagement-${decision.state}`, why, context),
        evidence: { engagementCheckIn: decision.state },
      };
    case 'offer_break':
      return plan('BREAK', 'attention', why, context);
    case 'change_subject':
      return changeSubject(context, why);
    case 'switch_modality':
      return plan('RETEACH', 'visual-model', why, context);
    default:
      return plan('ASK', 'easier-item', why, context);
  }
}

/** Something different: another strand if there is one, the next topic, or a picture instead. */
export function changeSubject<TModelContext>(
  context: LoadedTurnContext<TModelContext>,
  why: string,
): MovePlan {
  const target = context.session.alternateStrandSkill ?? context.session.nextTopic;
  if (target === null) return plan('RETEACH', 'visual-model', why, context);
  return { ...plan('SWITCH', 'something-different', why, context), skillCode: target };
}
