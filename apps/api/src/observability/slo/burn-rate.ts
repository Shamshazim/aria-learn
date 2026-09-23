import { LATENCY_BUCKETS_MS } from '@/observability/metrics';
import type { Slo } from '@/observability/slo/slos';

/**
 * Multi-window, multi-burn-rate alerts, from the SLO registry (X-04).
 *
 * "Alerts page on burn rate, not on single samples." A single slow turn is a child's tablet on
 * a train; a sustained fraction of slow turns is a system that has stopped meeting a promise.
 * Alerting on the first is how a team learns to ignore the pager.
 *
 * The scheme is the standard one: an error budget over a period, and an alert when the budget
 * is being consumed fast enough to exhaust it early — checked over a long window so it means
 * something, and confirmed by a short one so it clears quickly once the problem stops.
 *
 * Two severities. `page` fires on a fast burn (14.4x, which exhausts a 30-day budget in two
 * days) and wakes somebody. `ticket` fires on a slow burn (6x) and does not.
 */
export type BurnRateSeverity = 'page' | 'ticket';

export type BurnRateWindow = Readonly<{
  severity: BurnRateSeverity;
  /** How many times faster than sustainable the budget is being spent. */
  factor: number;
  /** The window that has to agree for the alert to fire, and the short one that confirms it. */
  longWindow: string;
  shortWindow: string;
}>;

/** 30 days of budget: the factors and windows from the Google SRE workbook's table. */
export const BURN_RATE_WINDOWS: readonly BurnRateWindow[] = [
  { severity: 'page', factor: 14.4, longWindow: '1h', shortWindow: '5m' },
  { severity: 'page', factor: 6, longWindow: '6h', shortWindow: '30m' },
  { severity: 'ticket', factor: 3, longWindow: '1d', shortWindow: '2h' },
  { severity: 'ticket', factor: 1, longWindow: '3d', shortWindow: '6h' },
];

export type AlertRule = Readonly<{
  alert: string;
  expr: string;
  for: string;
  labels: Readonly<{ severity: BurnRateSeverity; slo: string }>;
  annotations: Readonly<{ summary: string; bar: string; runbook: string }>;
}>;

export class SloRuleError extends Error {
  override readonly name = 'SloRuleError';
}

/**
 * The rules for one SLO, one per burn-rate window.
 *
 * An SLO with no metric behind it produces nothing and says so by throwing: generating a rule
 * that queries a metric nobody emits creates an alert that can never fire, which is worse than
 * an acknowledged gap because it looks like coverage.
 */
export function rulesFor(slo: Slo): readonly AlertRule[] {
  if (slo.status !== 'instrumented') {
    throw new SloRuleError(`${slo.id} is not instrumented; it has no rule to generate`);
  }
  const budget = 1 - objectiveShare(slo);
  if (budget <= 0) {
    throw new SloRuleError(`${slo.id} allows no error budget, so no burn rate can be expressed`);
  }
  return BURN_RATE_WINDOWS.map((window) => ({
    alert: alertName(slo, window),
    expr: expression(slo, window, budget),
    // Long enough that a single scrape gap cannot page anybody, short enough to be news.
    for: '2m',
    labels: { severity: window.severity, slo: slo.id },
    annotations: {
      summary: `${slo.title} is missing its bar (${String(window.factor)}x budget burn)`,
      bar: slo.bar,
      runbook: `infra/alerts/runbooks/${slo.id}.md`,
    },
  }));
}

export function allRules(slos: readonly Slo[]): readonly AlertRule[] {
  return slos.filter((slo) => slo.status === 'instrumented').flatMap(rulesFor);
}

function alertName(slo: Slo, window: BurnRateWindow): string {
  const suffix = window.severity === 'page' ? 'Fast' : 'Slow';
  return `${pascal(slo.id)}BudgetBurn${suffix}${window.longWindow}`;
}

/**
 * The bad-event ratio over a window, compared with the budget times the burn factor.
 *
 * Both windows must agree. Without the short one an alert keeps firing for the length of the
 * long window after the problem is fixed, which is how an on-call rotation learns that a
 * resolved alert still pages.
 */
function expression(slo: Slo, window: BurnRateWindow, budget: number): string {
  const threshold = (budget * window.factor).toPrecision(3);
  return (
    `(${badRatio(slo, window.longWindow)} > ${threshold})` +
    ` and (${badRatio(slo, window.shortWindow)} > ${threshold})`
  );
}

/**
 * The share of events that missed the bar, as a PromQL expression.
 *
 * A latency SLO reads it straight off the histogram: everything at or below the threshold
 * bucket is good, so one minus that over the total is the bad share — which is why the bucket
 * bounds in `metrics.ts` are chosen to land exactly on the §11 numbers.
 */
function badRatio(slo: Slo, window: string): string {
  const total = required(slo.source.total, slo.id, 'total');
  if (slo.objective.kind === 'latency') {
    const le = leBoundFor(slo);
    return (
      `1 - (sum(rate(${total}_bucket{le="${le}"}[${window}]))` +
      ` / sum(rate(${total}_count[${window}])))`
    );
  }
  const good = required(slo.source.good, slo.id, 'good');
  if (slo.objective.direction === 'at_most') {
    return `sum(rate(${good}[${window}])) / sum(rate(${total}[${window}]))`;
  }
  return `1 - (sum(rate(${good}[${window}])) / sum(rate(${total}[${window}])))`;
}

/**
 * A threshold with no bucket boundary is refused rather than rounded.
 *
 * Rounding to the nearest bucket would silently alert on a different number than the one in
 * §11 — a 250ms bar watched at 500ms is not the bar, and nobody would ever notice.
 */
function leBoundFor(slo: Slo): string {
  if (slo.objective.kind !== 'latency') throw new SloRuleError(`${slo.id} is not a latency SLO`);
  const threshold = slo.objective.thresholdMs;
  if (!LATENCY_BUCKETS_MS.includes(threshold)) {
    throw new SloRuleError(
      `${slo.id} needs a ${String(threshold)}ms bucket bound; LATENCY_BUCKETS_MS has none`,
    );
  }
  return String(threshold);
}

function objectiveShare(slo: Slo): number {
  return slo.objective.kind === 'latency'
    ? slo.objective.share
    : slo.objective.direction === 'at_most'
      ? 1 - slo.objective.share
      : slo.objective.share;
}

function required(value: string | null, id: string, part: string): string {
  if (value === null) throw new SloRuleError(`${id} is instrumented but names no ${part} metric`);
  return value;
}

function pascal(id: string): string {
  return id
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}
