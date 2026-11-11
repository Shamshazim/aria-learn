import { CLIENT_TIMING_KINDS, type Band, type ClientTimingKind } from '@aria/shared';

import type { Metrics } from '@/observability/metrics';

/**
 * The §11 bars only a browser can see, as histograms (X-04 part 2).
 *
 * `turn-metrics.ts` records the two bars a server observes on its own and says, in as many
 * words, that the audible welcome and interrupt-to-silence are deliberately not there. This
 * is the other half: the same histogram shape, fed from `POST /telemetry/turn` instead of
 * from a turn, so that `slo/slos.ts` can stop carrying them as `not_instrumented`.
 *
 * Nothing here is derived from a child. The only label is band, exactly as in `turn-metrics`,
 * which bounds each series at three and keeps a session id from ever reaching a metric name.
 */
export const ARRIVAL_VISIBLE_MS = 'arrival_visible_ms';
export const AUDIO_UNLOCKED_MS = 'audio_unlocked_ms';
export const AUDIBLE_WELCOME_MS = 'audible_welcome_ms';
export const INTERRUPT_SILENCE_MS = 'interrupt_silence_ms';

/** A measurement arrived that no bar could believe. Counted so the dropping is visible. */
export const CLIENT_TIMING_IMPLAUSIBLE_TOTAL = 'client_timing_implausible_total';

/** A measurement arrived from the synthetic probe and was kept out of the bars. */
export const CLIENT_TIMING_SYNTHETIC_TOTAL = 'client_timing_synthetic_total';

/**
 * One histogram per reportable measurement.
 *
 * A record rather than a switch, so a new bar is a new entry in two places that a compiler
 * checks against each other — `CLIENT_TIMING_KINDS` and this — rather than a case somebody
 * has to remember to add (CODE-STANDARDS §4).
 */
const METRIC_BY_KIND: Readonly<Record<ClientTimingKind, string>> = {
  arrival_visible: ARRIVAL_VISIBLE_MS,
  audio_unlocked: AUDIO_UNLOCKED_MS,
  audible_welcome: AUDIBLE_WELCOME_MS,
  interrupt_silence: INTERRUPT_SILENCE_MS,
};

/**
 * The longest duration each bar will believe, in milliseconds.
 *
 * This is not a second copy of the §11 thresholds and must never be read as one: a bar is
 * missed at 1001ms and that miss is the whole point of measuring. These are the numbers past
 * which a *client* is no longer describing the thing the bar names.
 *
 * The case that forces them is ordinary. A child's tab goes to the background — another app,
 * a screen lock, a sibling — and `performance.now()` keeps running while the browser stops
 * doing work. The page comes back, finishes the measurement, and reports four minutes for an
 * audible welcome. Folded into a histogram, one of those drags a p95 further than a hundred
 * genuinely slow turns, and the bar starts describing how often children put tablets down.
 *
 * Generous, because the cost of the two mistakes is not symmetric: a slow turn wrongly dropped
 * hides a real problem, so the ceiling sits far above anything a working system produces and
 * only catches durations that cannot be a turn at all. Two minutes for the arrival and unlock
 * measurements, which wait on a person; thirty seconds for the two that wait on software.
 */
const CEILING_MS_BY_KIND: Readonly<Record<ClientTimingKind, number>> = {
  arrival_visible: 120_000,
  audio_unlocked: 120_000,
  audible_welcome: 30_000,
  interrupt_silence: 30_000,
};

export type ClientTimingObservation = Readonly<{
  kind: ClientTimingKind;
  ms: number;
  band: Band;
  /** X-04: the report came from the synthetic probe, so it stays out of the §11 bars. */
  isSynthetic: boolean;
}>;

/** What the caller learns about one measurement, so a service can count and a route reply. */
export type ClientTimingOutcome = 'recorded' | 'implausible' | 'synthetic';

export type ClientTimingObserver = (observation: ClientTimingObservation) => ClientTimingOutcome;

export function createClientTimingObserver(deps: { metrics: Metrics }): ClientTimingObserver {
  return ({ kind, ms, band, isSynthetic }) => {
    if (!isPlausible(kind, ms)) {
      deps.metrics.increment(CLIENT_TIMING_IMPLAUSIBLE_TOTAL, { kind });
      return 'implausible';
    }
    // Counted, not observed. The §11 bars are promises about what a child experienced, and a
    // probe is not a child: folding its turns in would make every bar partly a measurement of
    // our own monitoring, moving whenever the probe's schedule changes. The probe still has a
    // number here — the counter proves it is reporting — and when the probe lands (X-04 part
    // 2, needs staging) it gets bars of its own rather than a share of these.
    if (isSynthetic) {
      deps.metrics.increment(CLIENT_TIMING_SYNTHETIC_TOTAL, { kind });
      return 'synthetic';
    }
    deps.metrics.observe(metricFor(kind), ms, { band });
    return 'recorded';
  };
}

export function metricFor(kind: ClientTimingKind): string {
  return METRIC_BY_KIND[kind];
}

/** Every histogram this module can write, for a test that asserts the export shape. */
export function clientTimingMetricNames(): readonly string[] {
  return CLIENT_TIMING_KINDS.map(metricFor);
}

function isPlausible(kind: ClientTimingKind, ms: number): boolean {
  return Number.isFinite(ms) && ms >= 0 && ms <= CEILING_MS_BY_KIND[kind];
}
