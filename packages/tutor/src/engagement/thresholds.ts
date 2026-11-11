import type { Band } from '@aria/shared';

/**
 * When a passive observation becomes a signal, per band (P3-05).
 *
 * Generous on purpose. A six-year-old who takes twenty seconds over a sum is often thinking,
 * not drifting; the cost of calling that a signal is a check-in nobody needed, and the cost of
 * missing it is one more question. These numbers only decide what *counts*: no single passive
 * signal is enough to ask about on its own (`signals.ts`).
 */
export type EngagementThresholds = Readonly<{
  /** An answer slower than this, to a question that wanted a typed, tapped or spoken answer. */
  latencySlowMs: number;
  /** Wrong answers in a row on the session that make `errors_repeated`. */
  errorRun: number;
  /** Silences in a row that make `silence`. The ladder (P2H-01) handles the first ones. */
  silenceRun: number;
  /** Fewer words than this, to an open question, makes `short_answers`. */
  shortAnswerWords: number;
}>;

export const ENGAGEMENT_THRESHOLDS: Readonly<Record<Band, EngagementThresholds>> = {
  early: { latencySlowMs: 20_000, errorRun: 3, silenceRun: 2, shortAnswerWords: 2 },
  middle: { latencySlowMs: 15_000, errorRun: 3, silenceRun: 2, shortAnswerWords: 3 },
  senior: { latencySlowMs: 12_000, errorRun: 3, silenceRun: 2, shortAnswerWords: 4 },
};

/** A tab hidden for less than this is a notification banner, not a child walking away. */
export const TAB_HIDDEN_MIN_MS = 3_000;
/** Hidden this long is `idle`, not `tab_hidden`. */
export const IDLE_MS = 30_000;

/** How long a state lives after its last supporting signal. */
export const STATE_LIFETIME_MS = 5 * 60_000;

/** Below this nothing is said; from here to `ACT_CONFIDENCE` Aria asks (§4.3). */
export const CHECK_IN_CONFIDENCE = 0.4;
/** At or above this she acts instead of asking. */
export const ACT_CONFIDENCE = 0.7;
