import { describe, expect, it } from 'vitest';

import { buildPhase1Report, formatPhase1Report } from '@/observability/report/phase1.report';
import type { Phase1MetricData } from '@/repositories/phase1-metrics.repository';

describe('Phase 1 report', () => {
  it('derives every blocking bar and text-path span from known events', () => {
    const report = buildPhase1Report(fixture());
    expect(report.content_wait_p95_ms).toMatchObject({ value: 500, status: 'met' });
    expect(report.wrong_without_approach_change).toMatchObject({ value: 0, status: 'met' });
    expect(report.hint_next_attempt_correct_rate).toMatchObject({ value: 1, status: 'met' });
    expect(report.arrival_api_p95_ms).toMatchObject({ value: 200, status: 'met' });
    expect(report.durable_fact_evidence_rate).toMatchObject({ value: 1, status: 'met' });
    expect(report.parent_correction_next_session_rate).toMatchObject({ value: 1, status: 'met' });
    expect(report.gate_ms_p95).toMatchObject({ value: 50, status: 'target' });
    expect(formatPhase1Report(report)).toContain('e2e_ms_p95');
  });

  it('calls an empty sample not enough data, never a pass', () => {
    const empty: Phase1MetricData = {
      events: [],
      endReasons: [],
      arrivalLatencies: [],
      factCount: 0,
      frustrationExitCount: 0,
      supportedFactCount: 0,
      correctionCount: 0,
      reflectedCorrectionCount: 0,
    };
    expect(
      Object.values(buildPhase1Report(empty)).every(
        (metric) => metric.status === 'not_enough_data',
      ),
    ).toBe(true);
  });
});

function fixture(): Phase1MetricData {
  return {
    events: [
      event({ seq: 1, actor: 'child', kind: 'ANSWER', correct: false, approach: null }),
      event({ seq: 2, actor: 'aria', kind: 'RETEACH', correct: null, approach: 'visual-model' }),
      event({ seq: 3, actor: 'child', kind: 'ANSWER', correct: false, approach: null }),
      event({ seq: 4, actor: 'aria', kind: 'HINT', correct: null, approach: 'worked-example' }),
      event({ seq: 5, actor: 'child', kind: 'ANSWER', correct: true, approach: null }),
    ],
    endReasons: ['complete'],
    frustrationExitCount: 0,
    arrivalLatencies: [200],
    factCount: 2,
    supportedFactCount: 2,
    correctionCount: 1,
    reflectedCorrectionCount: 1,
  };
}

function event(
  input: Readonly<{
    seq: number;
    actor: string;
    kind: string;
    correct: boolean | null;
    approach: string | null;
  }>,
): Phase1MetricData['events'][number] {
  return {
    sessionId: 'session-1',
    seq: input.seq,
    actor: input.actor,
    kind: input.kind,
    correct: input.correct,
    latencyMs: null,
    evidence: {
      ...(input.approach === null ? {} : { approach: input.approach }),
      ...(input.actor === 'aria' ? { spans: { eou_ms: 0, gate_ms: 50, e2e_ms: 500 } } : {}),
    },
  };
}
