import { describe, expect, it } from 'vitest';

import { CLIENT_TIMING_KINDS } from '@aria/shared';

import {
  AUDIBLE_WELCOME_MS,
  CLIENT_TIMING_IMPLAUSIBLE_TOTAL,
  CLIENT_TIMING_SYNTHETIC_TOTAL,
  INTERRUPT_SILENCE_MS,
  clientTimingMetricNames,
  createClientTimingObserver,
  metricFor,
} from '@/observability/client-metrics';
import { createMetrics } from '@/observability/metrics';
import { instrumentedSlos } from '@/observability/slo/slos';

/**
 * X-04 part 2: "client timings arrive for arrival, first audio and interrupt silence, and are
 * excluded from reports when `is_synthetic`."
 *
 * The cases that matter are the ones where a measurement should *not* reach a histogram, so
 * most of this is about refusal: a backgrounded tab's four-minute welcome, the synthetic
 * probe's scripted session, and anything carrying a label the exporter would have to withhold.
 */
describe('the client timing observer', () => {
  it('records a believable measurement under the metric its bar reads', () => {
    const metrics = createMetrics();
    const observe = createClientTimingObserver({ metrics });

    expect(observe({ kind: 'audible_welcome', ms: 820, band: 'early', isSynthetic: false })).toBe(
      'recorded',
    );

    const histogram = metrics.collect().histograms.find((h) => h.name === AUDIBLE_WELCOME_MS);
    expect(histogram?.count).toBe(1);
    expect(histogram?.sum).toBe(820);
    expect(histogram?.labels).toEqual({ band: 'early' });
  });

  it.each(CLIENT_TIMING_KINDS)('has a histogram for %s', (kind) => {
    const metrics = createMetrics();

    createClientTimingObserver({ metrics })({ kind, ms: 100, band: 'middle', isSynthetic: false });

    expect(metrics.collect().histograms.map((h) => h.name)).toEqual([metricFor(kind)]);
  });

  /**
   * The case this guard exists for: a child's tab goes to the background, `performance.now()`
   * keeps running while the browser stops working, and the page reports four minutes for a
   * measurement that should be under a second. One of those drags a p95 further than a hundred
   * genuinely slow turns.
   */
  it('refuses a duration no bar could believe, and counts the refusal', () => {
    const metrics = createMetrics();
    const observe = createClientTimingObserver({ metrics });

    expect(
      observe({ kind: 'audible_welcome', ms: 240_000, band: 'early', isSynthetic: false }),
    ).toBe('implausible');

    expect(metrics.collect().histograms).toEqual([]);
    expect(metrics.snapshot().counters).toMatchObject({
      [`${CLIENT_TIMING_IMPLAUSIBLE_TOTAL}{kind=audible_welcome}`]: 1,
    });
  });

  /**
   * The ceilings are not a second copy of the §11 thresholds, and this is the assertion that
   * says so: a bar is *missed* at 1001ms, and that miss is the whole point of measuring.
   */
  it('records a measurement that misses its bar, because missing it is the news', () => {
    const metrics = createMetrics();

    const outcome = createClientTimingObserver({ metrics })({
      kind: 'interrupt_silence',
      ms: 2_400,
      band: 'senior',
      isSynthetic: false,
    });

    expect(outcome).toBe('recorded');
    expect(metrics.collect().histograms.find((h) => h.name === INTERRUPT_SILENCE_MS)?.count).toBe(
      1,
    );
  });

  it('keeps the synthetic probe out of the bars but counts that it reported', () => {
    const metrics = createMetrics();

    const outcome = createClientTimingObserver({ metrics })({
      kind: 'arrival_visible',
      ms: 310,
      band: 'early',
      isSynthetic: true,
    });

    expect(outcome).toBe('synthetic');
    expect(metrics.collect().histograms).toEqual([]);
    expect(metrics.snapshot().counters).toMatchObject({
      [`${CLIENT_TIMING_SYNTHETIC_TOTAL}{kind=arrival_visible}`]: 1,
    });
  });

  /**
   * X-04: "no label carries a student or session id". The report carries a session id — it is
   * the only identifier in it — so the one thing that must never happen is that id becoming a
   * label. Band is three values; the series count is bounded by a constant.
   */
  it('labels a histogram with the band and nothing else', () => {
    const metrics = createMetrics();
    const observe = createClientTimingObserver({ metrics });

    for (const band of ['early', 'middle', 'senior'] as const) {
      observe({ kind: 'audible_welcome', ms: 500, band, isSynthetic: false });
    }

    const labels = metrics.collect().histograms.map((h) => Object.keys(h.labels));
    expect(labels).toEqual([['band'], ['band'], ['band']]);
  });
});

/**
 * The join between this module and the registry. An SLO naming a metric nothing emits is an
 * alert that can never fire, which looks like coverage and is not — the failure `slos.ts`
 * exists to prevent, caught here from the other side.
 */
describe('the bars these metrics instrument', () => {
  it.each(['audible_welcome', 'interrupt_silence'])('%s reads a metric this module emits', (id) => {
    const slo = instrumentedSlos().find((candidate) => candidate.id === id);

    expect(slo).toBeDefined();
    expect(clientTimingMetricNames()).toContain(slo?.source.total);
  });
});
