import type { EngagementStateKind } from '@aria/shared';

/**
 * The evidence an engagement state is inferred from (P3-05, `master-plan.md` §4.3).
 *
 * Safe signals only: what the child did, how long it took, what they said about themselves,
 * and whether the tab was in front of them. No camera, no facial or voice-emotion model; a
 * `vocal_cue` exists only when the parent consented to it, and the API drops it otherwise.
 * `answered_well` and `said_fine` are the two that argue the other way.
 */
export const ENGAGEMENT_SIGNAL_NAMES = [
  'latency_slow',
  'errors_repeated',
  'silence',
  'short_answers',
  'stop_request',
  'said_tired',
  'said_bored',
  'said_frustrated',
  'vocal_cue',
  'tab_hidden',
  'idle',
  'answered_well',
  'said_fine',
] as const;

export type EngagementSignalName = (typeof ENGAGEMENT_SIGNAL_NAMES)[number];

export type EngagementSignal = Readonly<{
  name: EngagementSignalName;
  at: Date;
  /** `vocal_cue` only: the state the worker heard. */
  suggests?: EngagementStateKind;
}>;

/**
 * What the estimator believes about the session right now. Temporary by construction: it
 * expires five minutes after its last supporting signal and is never written anywhere but the
 * session log. `ready` with confidence 0 means "nothing inferred", not "the child is fine".
 */
export type EngagementState = Readonly<{
  kind: EngagementStateKind;
  confidence: number;
  evidence: readonly EngagementSignal[];
  expiresAt: Date | null;
}>;

export type AdaptationKind =
  'none' | 'shorten' | 'switch_modality' | 'offer_break' | 'change_subject' | 'check_in';

export type AdaptationDecision = Readonly<{
  kind: AdaptationKind;
  state: EngagementStateKind;
  confidence: number;
  /** A second high-confidence hit for a state already adapted to, turned into a break offer. */
  escalated: boolean;
}>;

/** What this session has already done about each state, read back from its log. */
export type EngagementHistory = Readonly<{
  checkedIn: readonly EngagementStateKind[];
  adapted: readonly EngagementStateKind[];
  escalated: readonly EngagementStateKind[];
  /** States the child said were wrong ("I'm not tired"). Never asked about again. */
  denied: readonly EngagementStateKind[];
}>;

/** A check-in Aria asked that the child has not answered yet. */
export type OpenCheckIn = Readonly<{ state: EngagementStateKind; moveId: string }>;

/** Everything the policy needs to know about engagement, loaded with the turn. */
export type EngagementContext = Readonly<{
  /** Signals from earlier events in the session, in any order. */
  signals: readonly EngagementSignal[];
  /** What the question this event answers expected, so its own passive signals can be read. */
  current?: Readonly<{ expects: string | null; openQuestion: boolean }>;
  history: EngagementHistory;
  /** The last state the log recorded, so a change is written once rather than every turn. */
  previous: Readonly<{ kind: EngagementStateKind; confidence: number }> | null;
  openCheckIn: OpenCheckIn | null;
}>;

export const EMPTY_HISTORY: EngagementHistory = {
  checkedIn: [],
  adapted: [],
  escalated: [],
  denied: [],
};
