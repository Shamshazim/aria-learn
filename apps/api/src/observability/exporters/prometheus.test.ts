import { describe, expect, it } from 'vitest';

import { renderPrometheus, SERIES_REJECTED_TOTAL } from '@/observability/exporters/prometheus';
import { createMetrics, SERIES_DROPPED_TOTAL } from '@/observability/metrics';

/**
 * X-04: `/metrics` exports every counter and histogram, and no label carries an identifier.
 *
 * The second claim is the one with teeth. A metric is sent to a third party and kept for
 * months by something that does not know about a child's deletion request, so a session id in
 * a label is a privacy incident that a unit test is the cheapest possible place to catch.
 */
const SESSION_ID = '4b14e6aa-208a-4a70-b4c4-99f716315ab9';

describe('the exposition', () => {
  it('renders a counter with its type line and its labels', () => {
    const metrics = createMetrics();
    metrics.increment('fallback_used_total', { move: 'SAY', reason: 'gate_failed' });
    metrics.increment('fallback_used_total', { move: 'SAY', reason: 'gate_failed' });

    expect(renderPrometheus(metrics.collect()).body).toBe(
      '# TYPE fallback_used_total counter\n' +
        'fallback_used_total{move="SAY",reason="gate_failed"} 2\n',
    );
  });

  it('renders a histogram cumulatively, with +Inf, sum and count', () => {
    const metrics = createMetrics({ buckets: [100, 500] });
    metrics.observe('turn_ms', 40, { band: 'middle' });
    metrics.observe('turn_ms', 300, { band: 'middle' });
    metrics.observe('turn_ms', 900, { band: 'middle' });

    expect(renderPrometheus(metrics.collect()).body).toBe(
      [
        '# TYPE turn_ms histogram',
        'turn_ms_bucket{band="middle",le="100"} 1',
        'turn_ms_bucket{band="middle",le="500"} 2',
        'turn_ms_bucket{band="middle",le="+Inf"} 3',
        'turn_ms_sum{band="middle"} 1240',
        'turn_ms_count{band="middle"} 3',
        '',
      ].join('\n'),
    );
  });

  it('emits one TYPE line per metric, however many label combinations it has', () => {
    const metrics = createMetrics();
    metrics.increment('gate_rejections_total', { band: 'early' });
    metrics.increment('gate_rejections_total', { band: 'senior' });

    expect(
      renderPrometheus(metrics.collect()).body.match(/# TYPE gate_rejections_total/gu),
    ).toEqual(['# TYPE gate_rejections_total']);
  });

  it('is valid for an empty store', () => {
    expect(renderPrometheus(createMetrics().collect())).toEqual({ body: '\n', rejected: 0 });
  });
});

describe('what never leaves the process', () => {
  it.each([
    ['a session id label', { sessionId: SESSION_ID }],
    ['a snake-cased student id', { student_id: 'abc' }],
    ['a child id', { childId: 'abc' }],
    ['a parent email', { email: 'grown.up@example.test' }],
    ['a name', { name: 'Ada' }],
    ['a uuid under an innocent label', { room: SESSION_ID }],
    ['a long hex token under an innocent label', { key: 'a'.repeat(40) }],
  ])('withholds a series carrying %s', (_case, labels) => {
    const metrics = createMetrics();
    metrics.increment('turns_total', labels);

    const result = renderPrometheus(metrics.collect());

    expect(result.body).not.toContain('turns_total{');
    expect(result.rejected).toBe(1);
    expect(result.body).toContain(`${SERIES_REJECTED_TOTAL} 1`);
  });

  it('keeps the labels the ticket does allow', () => {
    const metrics = createMetrics();
    metrics.increment('turns_total', {
      band: 'middle',
      move: 'ASK',
      endpoint: 'groq-compatible',
      environment: 'staging',
    });

    expect(renderPrometheus(metrics.collect()).body).toContain('band="middle"');
  });

  /** A rejected series must not silently vanish: the count is itself a metric to alert on. */
  it('counts rejections rather than hiding them', () => {
    const metrics = createMetrics();
    metrics.increment('a_total', { sessionId: SESSION_ID });
    metrics.observe('b_ms', 1, { sessionId: SESSION_ID });

    expect(renderPrometheus(metrics.collect()).rejected).toBe(2);
  });
});

describe('the store itself', () => {
  /**
   * The defect this replaced: every observation was appended to an array, so memory grew with
   * uptime. Bucket counts are constant per series, which a test can state as a fixed shape.
   */
  it('keeps a constant amount per series however many samples arrive', () => {
    const metrics = createMetrics({ buckets: [100] });
    for (let i = 0; i < 50_000; i += 1) metrics.observe('turn_ms', i % 200, { band: 'middle' });

    const [histogram] = metrics.collect().histograms;

    expect(histogram?.counts).toHaveLength(2);
    expect(histogram?.count).toBe(50_000);
  });

  it('escapes a label value that would otherwise break the format', () => {
    const metrics = createMetrics();
    metrics.increment('a_total', { reason: 'he said "no"\nthen \\left' });

    expect(renderPrometheus(metrics.collect()).body).toContain(
      'reason="he said \\"no\\"\\nthen \\\\left"',
    );
  });

  /**
   * A label with unbounded values is the failure that takes a metrics system down. It has to
   * be survivable: the series already recorded keep working and the overflow is counted.
   */
  it('caps the series per metric and counts what it dropped', () => {
    const metrics = createMetrics({ maxSeriesPerMetric: 3 });
    for (let i = 0; i < 10; i += 1) metrics.increment('leaky_total', { attempt: String(i) });

    const body = renderPrometheus(metrics.collect()).body;

    expect(body.match(/^leaky_total\{/gmu)).toHaveLength(3);
    expect(body).toContain(`${SERIES_DROPPED_TOTAL}{metric="leaky_total"} 7`);
  });
});
