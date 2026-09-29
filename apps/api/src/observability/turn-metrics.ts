import type { Band } from '@aria/shared';

import type { Metrics } from '@/observability/metrics';

/**
 * The two §11 latency bars a server can see on its own (X-04).
 *
 * P1-14 already computes both after the fact, from `session_event`, by a report somebody has
 * to run. That answers "did we meet the bar last week". It cannot answer "are we meeting it
 * now", which is the question an alert asks — so the same numbers are also observed here, as
 * histograms, on the way past.
 *
 * The other two bars in §11 — the audible welcome and interrupt-to-silence — are deliberately
 * not here. Both are measured from inside the browser, and a server-side approximation of a
 * bar that names what a child heard would be a number that looks like the promise and is not
 * it. `slo/slos.ts` carries them as `not_instrumented` instead.
 */
export const ARRIVAL_MS = 'arrival_ms';
export const TURN_CONTENT_MS = 'turn_content_ms';
export const TURN_GATE_MS = 'turn_gate_ms';
export const TURNS_TOTAL = 'turns_total';

/**
 * Labels stay inside the bounded set X-04 allows: band, and the kind of move.
 *
 * Band is three values and move kind is fourteen, so the worst series count is a constant this
 * file can state — forty-two for the counter, three for each histogram, against a cap of two
 * hundred. Nothing here is derived from a child, a session or a request.
 */
export type ArrivalObservation = Readonly<{ band: Band; ms: number }>;

export type TurnObservation = Readonly<{
  band: Band;
  moveKinds: readonly string[];
  spans: Readonly<Record<string, number>>;
}>;

export function createArrivalObserver(deps: {
  metrics: Metrics;
}): (observation: ArrivalObservation) => void {
  return ({ band, ms }) => {
    deps.metrics.observe(ARRIVAL_MS, ms, { band });
  };
}

export function createTurnObserver(deps: {
  metrics: Metrics;
}): (observation: TurnObservation) => void {
  return ({ band, moveKinds, spans }) => {
    for (const move of moveKinds) deps.metrics.increment(TURNS_TOTAL, { band, move });
    // Band only, and not move kind: the bar is about a child waiting, not about which move the
    // wait produced, and a latency histogram is the one place a needless label costs the most.
    //
    // A span that was never recorded is absent, not zero: a turn that skipped the gate has no
    // gate time, and folding a zero into the histogram would make the bar look better than it is.
    observeSpan(deps.metrics, TURN_CONTENT_MS, spans.e2e_ms, { band });
    observeSpan(deps.metrics, TURN_GATE_MS, spans.gate_ms, { band });
  };
}

function observeSpan(
  metrics: Metrics,
  name: string,
  value: number | undefined,
  labels: Readonly<Record<string, string>>,
): void {
  if (value === undefined || !Number.isFinite(value)) return;
  metrics.observe(name, value, labels);
}
