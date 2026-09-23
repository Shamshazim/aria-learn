/**
 * Every bar in `master-plan.md` §11, as data (X-04).
 *
 * "Opinions do not count. These numbers do." — so the numbers live in exactly one place, and
 * the alert rules, the status route and the reports are all generated from it. A threshold
 * written twice is a threshold that disagrees with itself by the second quarter.
 *
 * A bar that cannot yet be measured is present and marked `not_instrumented` rather than
 * omitted. That is the whole point of the file: the list of what we promised is complete, and
 * the gap between it and what we actually watch is visible instead of implicit.
 */

export type SloStatus = 'instrumented' | 'not_instrumented';

/**
 * A latency objective: a share of events must complete within a threshold.
 *
 * Expressed as a share rather than as "the p95" because that is what can be alerted on from a
 * histogram across several instances — `p95 < 1s` and `95% of events < 1s` are the same claim,
 * but only the second one aggregates.
 */
export type LatencyObjective = Readonly<{
  kind: 'latency';
  /** The share that must be within the threshold, e.g. 0.95 for a p95 bar. */
  share: number;
  thresholdMs: number;
}>;

/** A ratio objective: a share of events must have some quality, e.g. ≥ 98% correct. */
export type RatioObjective = Readonly<{
  kind: 'ratio';
  /** The share that must hold. A "must be zero" bar is a share of 1 for its inverse. */
  share: number;
  /** Which direction is good, for the alert text and the runbook. */
  direction: 'at_least' | 'at_most';
}>;

export type SloObjective = LatencyObjective | RatioObjective;

/**
 * Where the numbers come from.
 *
 * `good` and `total` are metric names. For a latency SLO, `good` is the histogram and the
 * generator reads its bucket at the threshold; for a ratio SLO both are counters. Both are
 * `null` while an SLO is `not_instrumented`, which is what makes that state unfakeable.
 */
export type SloSource = Readonly<{ good: string | null; total: string | null }>;

export type Slo = Readonly<{
  id: string;
  /** What a person calls it, for an alert subject line and a runbook title. */
  title: string;
  /** The row in `master-plan.md` §11 this is, quoted, so a reader can check it. */
  bar: string;
  objective: SloObjective;
  source: SloSource;
  status: SloStatus;
  /** Why it is not instrumented, and what would instrument it. Empty when it is. */
  blockedBy?: string;
}>;

const LATENCY_P95 = (thresholdMs: number): LatencyObjective => ({
  kind: 'latency',
  share: 0.95,
  thresholdMs,
});

/**
 * The four latency bars and the quality bars that a running system can count.
 *
 * The learning and retention measures in §11 are deliberately absent: they are measured per
 * term against an external instrument, and an alert that pages somebody about a child's
 * reading growth at three in the morning would be both useless and obscene.
 */
export const SLOS: readonly Slo[] = [
  {
    id: 'content_wait',
    title: 'A child waits for content',
    bar: 'Child waits for content — < 1s at the 95th percentile',
    objective: LATENCY_P95(1_000),
    source: { good: 'turn_content_ms', total: 'turn_content_ms' },
    status: 'instrumented',
  },
  {
    id: 'visible_welcome',
    title: 'The welcome appears',
    bar: 'Visible personalised welcome after arrival — < 500ms at the 95th percentile',
    objective: LATENCY_P95(500),
    source: { good: 'arrival_ms', total: 'arrival_ms' },
    status: 'instrumented',
  },
  {
    id: 'audible_welcome',
    title: 'The welcome is spoken',
    bar: 'Audible welcome after audio is activated — starts < 1s at the 95th percentile',
    objective: LATENCY_P95(1_000),
    source: { good: null, total: null },
    status: 'not_instrumented',
    blockedBy:
      'The clock starts in the browser, at the moment audio is unlocked, and stops at the ' +
      'first sample out of the speaker. Only the client can see both ends, so this needs the ' +
      'client timing route (X-04 part 2) before it can be anything but a guess.',
  },
  {
    id: 'interrupt_silence',
    title: 'Aria stops when a child talks over her',
    bar: "Child interruption stops Aria's speech — < 250ms at the 95th percentile",
    objective: LATENCY_P95(250),
    source: { good: null, total: null },
    status: 'not_instrumented',
    blockedBy:
      'Measured from the child speaking to the speaker going quiet, which again only the ' +
      'client observes. The worker records its own half (detection to cancel) in P2H-07; the ' +
      'bar in §11 is the longer one, and reporting the shorter one as if it were the bar ' +
      'would be worse than reporting nothing.',
  },
  {
    id: 'end_of_turn',
    title: 'Aria knows when a child has finished speaking',
    bar: 'Correct end-of-turn detection in the voice test set — ≥ 98%',
    objective: { kind: 'ratio', share: 0.98, direction: 'at_least' },
    source: { good: null, total: null },
    status: 'not_instrumented',
    blockedBy:
      'This is a measurement against a labelled test set (P2-12 / P2H-13), not a property of ' +
      'live traffic: in production nothing knows whether a turn ended where the child meant ' +
      'it to. It belongs in the voice golden run, and is listed here so the §11 list is whole.',
  },
  {
    id: 'approach_changes_after_wrong',
    title: 'Aria changes approach after a wrong answer',
    bar: 'Two wrong answers without Aria changing approach — 0',
    objective: { kind: 'ratio', share: 1, direction: 'at_least' },
    source: { good: null, total: null },
    status: 'not_instrumented',
    blockedBy:
      'P1-14 computes this after the fact from `session_event` (`approachChangeViolations`), ' +
      'which needs the previous turn to compare against — so it is a stateful comparison ' +
      'rather than a counter a turn can emit on its own. Doing it live means the policy ' +
      'reporting whether it changed approach, which is a change to the policy, not to this.',
  },
  {
    id: 'static_fallback_reaches_a_child',
    title: 'A child gets canned text instead of teaching',
    bar: 'P2H-11: no static fallback reaches a child in a nominal session',
    objective: { kind: 'ratio', share: 0.01, direction: 'at_most' },
    // `fallback_used_total` is P0-25's; `turns_total` is this ticket's, which is what turned a
    // count of fallbacks into a rate. A count alone pages on traffic rather than on quality.
    source: { good: 'fallback_used_total', total: 'turns_total' },
    status: 'instrumented',
  },
];

export function sloById(id: string): Slo | undefined {
  return SLOS.find((slo) => slo.id === id);
}

export function instrumentedSlos(): readonly Slo[] {
  return SLOS.filter((slo) => slo.status === 'instrumented');
}

/** What `/status` reports: the promise, and whether anything is watching it. */
export type SloCoverage = Readonly<{
  total: number;
  instrumented: number;
  gaps: readonly Readonly<{ id: string; title: string; blockedBy: string }>[];
}>;

export function sloCoverage(slos: readonly Slo[] = SLOS): SloCoverage {
  const gaps = slos
    .filter((slo) => slo.status === 'not_instrumented')
    .map((slo) => ({ id: slo.id, title: slo.title, blockedBy: slo.blockedBy ?? 'unstated' }));
  return { total: slos.length, instrumented: slos.length - gaps.length, gaps };
}
