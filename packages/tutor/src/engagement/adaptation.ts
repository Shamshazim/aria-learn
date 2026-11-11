import type { EngagementStateKind } from '@aria/shared';

import { ACT_CONFIDENCE, CHECK_IN_CONFIDENCE } from './thresholds';

import type {
  AdaptationDecision,
  AdaptationKind,
  EngagementHistory,
  EngagementState,
} from './types';

/**
 * What a confident inference does (P3-05, §4.3: "shorten a prompt, switch modality, offer a
 * break or change subject"). Tired is offered a break, because the honest response to a tired
 * child is to stop; frustrated and uncertain get something shorter and easier; a child who has
 * drifted off gets something different.
 */
const ACTION: Readonly<Record<Exclude<EngagementStateKind, 'ready'>, AdaptationKind>> = {
  tired: 'offer_break',
  frustrated: 'shorten',
  uncertain: 'shorten',
  disengaged: 'change_subject',
};

/**
 * The response to an engagement state, bounded by what this session has already done.
 *
 * Below 0.4 nothing. Below 0.7 Aria asks — once per state per session, and never again about
 * a state the child said was wrong. At 0.7 or more she acts, once per state; the second
 * confident hit of the same state becomes a break offer, and after that she stops responding
 * to it, because a third adaptation is nagging.
 */
export function adapt(state: EngagementState, history: EngagementHistory): AdaptationDecision {
  const none = decision('none', state);
  if (state.kind === 'ready' || state.confidence < CHECK_IN_CONFIDENCE) return none;
  if (history.denied.includes(state.kind)) return none;
  if (state.confidence < ACT_CONFIDENCE) {
    return history.checkedIn.includes(state.kind) ? none : decision('check_in', state);
  }
  if (!history.adapted.includes(state.kind)) return decision(ACTION[state.kind], state);
  if (history.escalated.includes(state.kind)) return none;
  return { ...decision('offer_break', state), escalated: true };
}

function decision(kind: AdaptationKind, state: EngagementState): AdaptationDecision {
  return { kind, state: state.kind, confidence: state.confidence, escalated: false };
}
