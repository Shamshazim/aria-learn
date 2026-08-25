import {
  approachChangeViolations,
  evidenceCoverage,
  hintEffectiveness,
  p95Under,
  ratioUnder,
  type MetricValue,
} from '@/observability/session-metrics';
import type { Phase1MetricData } from '@/repositories/phase1-metrics.repository';

export type Phase1Report = Readonly<Record<string, MetricValue>>;

export function buildPhase1Report(data: Phase1MetricData): Phase1Report {
  const turnLatencies = spanValues(data.events, 'e2e_ms');
  return {
    content_wait_p95_ms: p95Under(turnLatencies, 1_000),
    wrong_without_approach_change: approachChangeViolations(data.events),
    frustration_exit_rate: ratioUnder(data.frustrationExitCount, data.endReasons.length, 0.05),
    hint_next_attempt_correct_rate: hintEffectiveness(data.events),
    arrival_api_p95_ms: p95Under(data.arrivalLatencies, 500),
    durable_fact_evidence_rate: evidenceCoverage(data.factCount, data.supportedFactCount),
    parent_correction_next_session_rate: evidenceCoverage(
      data.correctionCount,
      data.reflectedCorrectionCount,
    ),
    retrieved_context_tokens_p95: targetMetric(evidenceValues(data.events, 'contextTokens'), 0.95),
    eou_ms_p50: targetMetric(spanValues(data.events, 'eou_ms'), 0.5),
    eou_ms_p95: targetMetric(spanValues(data.events, 'eou_ms'), 0.95),
    gate_ms_p50: targetMetric(spanValues(data.events, 'gate_ms'), 0.5),
    gate_ms_p95: targetMetric(spanValues(data.events, 'gate_ms'), 0.95),
    e2e_ms_p50: targetMetric(turnLatencies, 0.5),
    e2e_ms_p95: targetMetric(turnLatencies, 0.95),
  };
}

function evidenceValues(
  events: readonly Phase1MetricData['events'][number][],
  key: string,
): readonly number[] {
  return events
    .map((event) => {
      const value = event.evidence[key];
      return typeof value === 'number' ? value : null;
    })
    .filter((value): value is number => value !== null);
}

export function formatPhase1Report(report: Phase1Report): string {
  return Object.entries(report)
    .map(
      ([name, metric]) =>
        `${name}: ${metric.value === null ? 'n/a' : metric.value.toFixed(3)} ` +
        `[${metric.status}; n=${String(metric.sampleSize)}]`,
    )
    .join('\n');
}

function spanValues(
  events: readonly Phase1MetricData['events'][number][],
  key: string,
): readonly number[] {
  return events
    .map((event) => {
      const spans = event.evidence.spans;
      if (!isRecord(spans)) return null;
      const value = spans[key];
      return typeof value === 'number' ? value : null;
    })
    .filter((value): value is number => value !== null);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function targetMetric(values: readonly number[], fraction: number): MetricValue {
  const value =
    values.length === 0
      ? null
      : ([...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1] ?? null);
  return {
    value,
    sampleSize: values.length,
    status: value === null ? 'not_enough_data' : 'target',
  };
}
