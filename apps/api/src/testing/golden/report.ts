import type { CheckName, GoldenItem, ItemResult } from '@/testing/golden/types';

const BARS: Readonly<Record<CheckName, number>> = {
  arithmetic_correctness: 1,
  factual_correctness: 0.99,
  correct_option_count: 1,
  reading_level: 0.98,
  markup: 1,
  decodable: 1,
  safety: 1,
};

export type GoldenReport = Readonly<{
  endpointName: string;
  promptName: 'practice-item';
  promptVersion: string;
  itemCount: number;
  humanReview: Readonly<{ approved: number; pending: number }>;
  coverage: Readonly<Record<'arithmetic' | 'reading' | 'writing', number>>;
  checks: Readonly<Record<CheckName, CheckReport>>;
  meanLatencyMs: number;
  p95LatencyMs: number;
  totalCostUsd: number;
  passed: boolean;
}>;

type CheckReport = Readonly<{
  passed: number;
  eligible: number;
  rate: number | null;
  bar: number;
  failingItemIds: readonly string[];
}>;

export function buildGoldenReport(input: {
  endpointName: string;
  promptVersion: string;
  items: readonly GoldenItem[];
  results: readonly ItemResult[];
}): GoldenReport {
  const checks = checkReports(input.results);
  const latencies = input.results.map((result) => result.latencyMs).sort((a, b) => a - b);
  const approved = input.items.filter((item) => item.humanReview.status === 'approved').length;
  return {
    endpointName: input.endpointName,
    promptName: 'practice-item',
    promptVersion: input.promptVersion,
    itemCount: input.items.length,
    humanReview: { approved, pending: input.items.length - approved },
    coverage: coverage(input.items),
    checks,
    meanLatencyMs: mean(latencies),
    p95LatencyMs: percentile95(latencies),
    totalCostUsd: input.results.reduce((total, result) => total + result.costUsd, 0),
    passed: approved === input.items.length && Object.values(checks).every(checkPasses),
  };
}

function checkReports(results: readonly ItemResult[]): Record<CheckName, CheckReport> {
  const report = emptyChecks();
  for (const result of results) {
    for (const name of CHECK_NAMES) {
      const outcome = result.checks[name];
      if (outcome === undefined) continue;
      const current = report[name];
      report[name] = {
        ...current,
        eligible: current.eligible + 1,
        passed: current.passed + (outcome ? 1 : 0),
        failingItemIds: outcome
          ? current.failingItemIds
          : [...current.failingItemIds, result.itemId],
      };
    }
  }
  for (const name of CHECK_NAMES) {
    const current = report[name];
    report[name] = {
      ...current,
      rate: current.eligible === 0 ? null : current.passed / current.eligible,
    };
  }
  return report;
}

function emptyChecks(): Record<CheckName, CheckReport> {
  return {
    arithmetic_correctness: blank('arithmetic_correctness'),
    factual_correctness: blank('factual_correctness'),
    correct_option_count: blank('correct_option_count'),
    reading_level: blank('reading_level'),
    markup: blank('markup'),
    decodable: blank('decodable'),
    safety: blank('safety'),
  };
}

function blank(name: CheckName): CheckReport {
  return { passed: 0, eligible: 0, rate: null, bar: BARS[name], failingItemIds: [] };
}

function coverage(items: readonly GoldenItem[]): GoldenReport['coverage'] {
  return {
    arithmetic: items.filter((item) => item.subject === 'arithmetic').length,
    reading: items.filter((item) => item.subject === 'reading').length,
    writing: items.filter((item) => item.subject === 'writing').length,
  };
}

function checkPasses(check: CheckReport): boolean {
  return check.rate !== null && check.rate >= check.bar;
}

function mean(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((total, value) => total + value, 0) / values.length;
}

function percentile95(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values[Math.ceil(values.length * 0.95) - 1] ?? 0;
}

const CHECK_NAMES: readonly CheckName[] = [
  'arithmetic_correctness',
  'factual_correctness',
  'correct_option_count',
  'reading_level',
  'markup',
  'decodable',
  'safety',
];
