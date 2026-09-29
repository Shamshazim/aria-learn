import { describe, expect, it } from 'vitest';

import { LATENCY_BUCKETS_MS } from '@/observability/metrics';
import { SLOS, sloCoverage, sloById } from '@/observability/slo/slos';

/**
 * X-04: "Every §11 bar exists in `slos.ts`", and a bar that cannot be measured is marked
 * rather than omitted.
 *
 * The bars are quoted from `master-plan.md` §11 in each entry, so this checks the shape and
 * the honesty of the list: no duplicate ids, no threshold that the histogram cannot express,
 * and — the one that matters — no entry claiming to be instrumented without naming the metric
 * that instruments it. That last one is how a list like this rots: a metric gets renamed, the
 * SLO keeps saying it is watched, and the alert silently queries nothing.
 */
describe('the SLO registry', () => {
  it('names the four §11 latency bars and the end-of-turn bar', () => {
    const ids = SLOS.map((slo) => slo.id);

    expect(ids).toContain('content_wait');
    expect(ids).toContain('visible_welcome');
    expect(ids).toContain('audible_welcome');
    expect(ids).toContain('interrupt_silence');
    expect(ids).toContain('end_of_turn');
  });

  it('has no duplicate ids', () => {
    expect(new Set(SLOS.map((slo) => slo.id)).size).toBe(SLOS.length);
  });

  it.each(SLOS.map((slo) => [slo.id, slo] as const))(
    '%s quotes the bar it came from',
    (_id, slo) => {
      expect(slo.bar.length).toBeGreaterThan(20);
      expect(slo.title.length).toBeGreaterThan(5);
    },
  );

  it.each(SLOS.filter((slo) => slo.status === 'instrumented').map((slo) => [slo.id, slo] as const))(
    '%s is instrumented, so it names the metrics behind it',
    (_id, slo) => {
      expect(slo.source.total).not.toBeNull();
      if (slo.objective.kind === 'ratio') expect(slo.source.good).not.toBeNull();
    },
  );

  /**
   * The inverse, and the more important half: an SLO that is *not* instrumented must not name
   * a metric, because a half-filled entry is the one somebody later reads as coverage.
   */
  it.each(
    SLOS.filter((slo) => slo.status === 'not_instrumented').map((slo) => [slo.id, slo] as const),
  )('%s is not instrumented, so it names no metric and says why', (_id, slo) => {
    expect(slo.source).toEqual({ good: null, total: null });
    expect(slo.blockedBy ?? '').not.toHaveLength(0);
  });

  /** A latency bar the buckets cannot express would be alerted on at the wrong number. */
  it.each(
    SLOS.filter((slo) => slo.status === 'instrumented' && slo.objective.kind === 'latency').map(
      (slo) => [slo.id, slo] as const,
    ),
  )('%s has a bucket boundary at its threshold', (_id, slo) => {
    if (slo.objective.kind !== 'latency') throw new Error('filtered above');

    expect(LATENCY_BUCKETS_MS).toContain(slo.objective.thresholdMs);
  });

  it('finds an SLO by id, and nothing for one that does not exist', () => {
    expect(sloById('content_wait')?.title).toBe('A child waits for content');
    expect(sloById('no_such_slo')).toBeUndefined();
  });
});

describe('the coverage /status reports', () => {
  it('counts what is watched and names what is not', () => {
    const coverage = sloCoverage();

    expect(coverage.total).toBe(SLOS.length);
    expect(coverage.instrumented).toBeGreaterThan(0);
    expect(coverage.instrumented).toBeLessThan(coverage.total);
    expect(coverage.gaps.map((gap) => gap.id)).toContain('interrupt_silence');
  });

  it('gives every gap a reason, so the route explains itself', () => {
    for (const gap of sloCoverage().gaps) {
      expect(gap.blockedBy).not.toBe('unstated');
    }
  });
});
