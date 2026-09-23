import { describe, expect, it } from 'vitest';

import { renderPrometheus } from '@/observability/exporters/prometheus';
import { createMetrics } from '@/observability/metrics';
import {
  ARRIVAL_MS,
  createArrivalObserver,
  createTurnObserver,
  TURN_CONTENT_MS,
  TURNS_TOTAL,
} from '@/observability/turn-metrics';

/**
 * X-04: the two §11 bars a server can measure, emitted live rather than only reported later.
 *
 * The labels are the thing to hold still. A latency histogram is where a needless label costs
 * the most — it multiplies every bucket — and a label with a child in it would be a privacy
 * incident, so both are asserted rather than left to review.
 */
describe('the turn observer', () => {
  it('counts a turn per move and times the turn once', () => {
    const metrics = createMetrics();

    createTurnObserver({ metrics })({
      band: 'middle',
      moveKinds: ['SAY', 'ASK'],
      spans: { e2e_ms: 420, gate_ms: 80 },
    });

    const snapshot = metrics.snapshot();
    expect(snapshot.counters[`${TURNS_TOTAL}{band=middle,move=SAY}`]).toBe(1);
    expect(snapshot.counters[`${TURNS_TOTAL}{band=middle,move=ASK}`]).toBe(1);
    expect(snapshot.histograms[`${TURN_CONTENT_MS}{band=middle}`]).toEqual({ count: 1, sum: 420 });
  });

  /**
   * The latency histogram is labelled by band only. The bar is about a child waiting, not about
   * which move the wait produced, and one label fewer here is fourteen fewer series.
   */
  it('does not label the latency histogram by move kind', () => {
    const metrics = createMetrics();

    createTurnObserver({ metrics })({
      band: 'senior',
      moveKinds: ['HINT'],
      spans: { e2e_ms: 100 },
    });

    expect(Object.keys(metrics.snapshot().histograms)).toEqual([`${TURN_CONTENT_MS}{band=senior}`]);
  });

  /** A span that never happened is absent, not zero: a zero would flatter the bar. */
  it('records nothing for a span the turn did not have', () => {
    const metrics = createMetrics();

    createTurnObserver({ metrics })({ band: 'early', moveKinds: ['SAY'], spans: {} });

    expect(metrics.snapshot().histograms).toEqual({});
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])('ignores a span of %s', (value) => {
    const metrics = createMetrics();

    createTurnObserver({ metrics })({
      band: 'early',
      moveKinds: ['SAY'],
      spans: { e2e_ms: value },
    });

    expect(metrics.snapshot().histograms).toEqual({});
  });
});

describe('the arrival observer', () => {
  it('times the welcome by band', () => {
    const metrics = createMetrics();

    createArrivalObserver({ metrics })({ band: 'early', ms: 180 });

    expect(metrics.snapshot().histograms[`${ARRIVAL_MS}{band=early}`]).toEqual({
      count: 1,
      sum: 180,
    });
  });

  /** Both observers feed the exporter, so nothing either of them emits may be withheld. */
  it('emits only labels the exporter will publish', () => {
    const metrics = createMetrics();
    createArrivalObserver({ metrics })({ band: 'middle', ms: 200 });
    createTurnObserver({ metrics })({
      band: 'middle',
      moveKinds: ['ASK'],
      spans: { e2e_ms: 300, gate_ms: 20 },
    });

    expect(renderPrometheus(metrics.collect()).rejected).toBe(0);
  });
});
