import { describe, expect, it } from 'vitest';

import { renderPrometheus } from '@/observability/exporters/prometheus';
import { createMetrics } from '@/observability/metrics';
import { allRules, rulesFor, SloRuleError } from '@/observability/slo/burn-rate';
import { SLOS, sloById, type Slo } from '@/observability/slo/slos';

/**
 * X-04: "`slo:rules` generates alert rules; each rule fires in a test with synthetic bad data."
 *
 * "Fires" is evaluated here rather than by standing up Prometheus: the rule is a ratio over a
 * window compared with a threshold, so the part worth testing is the arithmetic — would this
 * threshold be crossed by traffic this bad, and left alone by traffic that is merely imperfect.
 * A PromQL engine in a unit test would test Prometheus, not us.
 */
const CONTENT_WAIT = required('content_wait');
const FALLBACK = required('static_fallback_reaches_a_child');

describe('the generated rules', () => {
  it('produces one rule per burn-rate window for every instrumented SLO', () => {
    const instrumented = SLOS.filter((slo) => slo.status === 'instrumented');

    expect(allRules(SLOS)).toHaveLength(instrumented.length * 4);
  });

  it('generates nothing for an SLO nobody is measuring', () => {
    expect(allRules(SLOS.filter((slo) => slo.status === 'not_instrumented'))).toEqual([]);
  });

  it('refuses to generate a rule for an uninstrumented SLO asked for directly', () => {
    const gap = SLOS.find((slo) => slo.status === 'not_instrumented');
    if (gap === undefined) throw new Error('the registry claims every bar is measured');

    expect(() => rulesFor(gap)).toThrow(SloRuleError);
  });

  it('pages on the fast burn and only tickets on the slow one', () => {
    const rules = rulesFor(CONTENT_WAIT);

    expect(rules.filter((rule) => rule.labels.severity === 'page')).toHaveLength(2);
    expect(rules.filter((rule) => rule.labels.severity === 'ticket')).toHaveLength(2);
  });

  /** A short window and a long one, so a fixed problem stops paging promptly. */
  it('requires both windows to agree before firing', () => {
    const [fast] = rulesFor(CONTENT_WAIT);

    expect(fast?.expr).toContain('[1h]');
    expect(fast?.expr).toContain('[5m]');
    expect(fast?.expr).toContain(' and ');
  });

  it('queries the bucket at the threshold from the bar, not a rounded one', () => {
    expect(rulesFor(CONTENT_WAIT)[0]?.expr).toContain('turn_content_ms_bucket{le="1000"}');
    expect(rulesFor(required('visible_welcome'))[0]?.expr).toContain('arrival_ms_bucket{le="500"}');
  });

  /** An at_most bar is the ratio itself, not one minus it: more fallbacks is worse. */
  it('reads an at-most ratio in the direction the bar means', () => {
    const expr = rulesFor(FALLBACK)[0]?.expr ?? '';

    expect(expr).toContain('sum(rate(fallback_used_total[1h])) / sum(rate(turns_total[1h]))');
    expect(expr).not.toContain('1 - (sum(rate(fallback_used_total');
  });

  it('gives every rule a runbook path and the bar it came from', () => {
    for (const rule of allRules(SLOS)) {
      expect(rule.annotations.runbook).toBe(`infra/alerts/runbooks/${rule.labels.slo}.md`);
      expect(rule.annotations.bar.length).toBeGreaterThan(20);
    }
  });

  it('names each alert distinctly, so two rules cannot collide in the alert manager', () => {
    const names = allRules(SLOS).map((rule) => rule.alert);

    expect(new Set(names).size).toBe(names.length);
  });
});

/**
 * The thresholds, against traffic. Each case builds a real histogram, exports it, and computes
 * the same ratio the rule computes — so a change to the bucket bounds or to the expression
 * shows up here as a bar that stops being enforced.
 */
describe('a rule against synthetic traffic', () => {
  it('fires when nearly every turn is over the bar', () => {
    const ratio = badRatioFor('turn_content_ms', 1_000, [5_000, 5_000, 5_000, 5_000]);

    expect(ratio).toBe(1);
    expect(ratio).toBeGreaterThan(fastThreshold(CONTENT_WAIT));
  });

  it('stays quiet when every turn is inside the bar', () => {
    const ratio = badRatioFor('turn_content_ms', 1_000, [100, 250, 500, 900]);

    expect(ratio).toBe(0);
    expect(ratio).toBeLessThan(slowThreshold(CONTENT_WAIT));
  });

  /**
   * The case the whole burn-rate scheme exists for: a service missing the bar by a little is
   * not paged about, because 5% of turns over a second is the budget, not an incident.
   */
  it('does not page on traffic that is merely at its budget', () => {
    const samples = [
      ...Array.from({ length: 95 }, () => 200),
      ...Array.from({ length: 5 }, () => 2_000),
    ];
    const ratio = badRatioFor('turn_content_ms', 1_000, samples);

    expect(ratio).toBeCloseTo(0.05, 5);
    expect(ratio).toBeLessThan(fastThreshold(CONTENT_WAIT));
  });

  /** A value exactly on the bar is inside it: the bar is "< 1s", and `le` is inclusive. */
  it('counts a turn exactly on the boundary as good', () => {
    expect(badRatioFor('turn_content_ms', 1_000, [1_000])).toBe(0);
  });
});

/**
 * The bad-event share, computed from the exported histogram the way the rule does: one minus
 * the count at or below the threshold bucket, over the total.
 */
function badRatioFor(name: string, thresholdMs: number, samples: readonly number[]): number {
  const metrics = createMetrics();
  for (const sample of samples) metrics.observe(name, sample, { band: 'middle' });
  // Exported and re-read rather than taken from the store, so the number under test is the one
  // a scraper would actually see.
  const body = renderPrometheus(metrics.collect()).body;
  const good = valueOf(body, `${name}_bucket{band="middle",le="${String(thresholdMs)}"}`);
  const total = valueOf(body, `${name}_count{band="middle"}`);
  return 1 - good / total;
}

function valueOf(body: string, series: string): number {
  const line = body.split('\n').find((candidate) => candidate.startsWith(`${series} `));
  if (line === undefined) throw new Error(`no series ${series} in the exposition`);
  return Number(line.slice(series.length + 1));
}

function fastThreshold(slo: Slo): number {
  return thresholdOf(slo, 0);
}

function slowThreshold(slo: Slo): number {
  return thresholdOf(slo, 3);
}

/** The number the generated expression compares against, read back out of the rule itself. */
function thresholdOf(slo: Slo, index: number): number {
  const expr = rulesFor(slo)[index]?.expr ?? '';
  const matched = / > ([\d.]+)\)/u.exec(expr);
  if (matched?.[1] === undefined) throw new Error(`no threshold in ${expr}`);
  return Number(matched[1]);
}

function required(id: string): Slo {
  const slo = sloById(id);
  if (slo === undefined) throw new Error(`the registry has no ${id}`);
  return slo;
}
