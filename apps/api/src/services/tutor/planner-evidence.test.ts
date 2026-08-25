import { describe, expect, it } from 'vitest';

import type { PlannerObservation } from '@aria/tutor';

import { createMetrics } from '@/observability/metrics';
import {
  createPlannerObserver,
  PLANNER_DECISION_TOTAL,
  PLANNER_LATENCY_MS,
} from '@/services/tutor/planner-evidence';

function observation(overrides: Partial<PlannerObservation> = {}): PlannerObservation {
  return {
    allowedMoves: ['HINT', 'RETEACH'],
    proposed: { kind: 'RETEACH', approach: 'visual-model' },
    accepted: true,
    source: 'planner',
    rationale: 'The nudge already failed.',
    reason: null,
    ms: 240,
    ...overrides,
  };
}

function observe(input: PlannerObservation) {
  const metrics = createMetrics();
  const logged: unknown[] = [];
  createPlannerObserver({
    metrics,
    logger: {
      info: (payload: unknown) => {
        logged.push(payload);
      },
    },
  })(input);
  return {
    counters: metrics.snapshot().counters,
    histograms: metrics.snapshot().histograms,
    logged,
  };
}

describe('planner evidence', () => {
  it('records the set, the proposal and the verdict for an accepted plan', () => {
    const { counters, histograms, logged } = observe(observation());
    expect(counters[`${PLANNER_DECISION_TOTAL}{reason=accepted,source=planner}`]).toBe(1);
    expect(histograms[`${PLANNER_LATENCY_MS}{source=planner}`]).toEqual([240]);
    expect(logged[0]).toMatchObject({
      allowedMoves: ['HINT', 'RETEACH'],
      proposed: { kind: 'RETEACH', approach: 'visual-model' },
      accepted: true,
      source: 'planner',
      ms: 240,
    });
  });

  it('counts a rejection under its own reason', () => {
    const { counters } = observe(
      observation({
        accepted: false,
        source: 'planner-rejected',
        proposed: { kind: 'PRAISE', approach: 'default' },
        reason: 'not_allowed',
        rationale: null,
      }),
    );
    expect(counters[`${PLANNER_DECISION_TOTAL}{reason=not_allowed,source=planner-rejected}`]).toBe(
      1,
    );
  });

  it.each(['policy_decisive', 'single_allowed_move'] as const)(
    'keeps the latency honest when the planner was never asked (%s)',
    (reason) => {
      const { counters, histograms } = observe(
        observation({
          accepted: false,
          source: 'policy',
          proposed: null,
          reason,
          ms: 0,
          rationale: null,
        }),
      );
      expect(counters[`${PLANNER_DECISION_TOTAL}{reason=${reason},source=policy}`]).toBe(1);
      expect(histograms[`${PLANNER_LATENCY_MS}{source=policy}`]).toBeUndefined();
    },
  );

  it('still times a planner that timed out', () => {
    const { histograms } = observe(
      observation({
        accepted: false,
        source: 'policy',
        proposed: null,
        reason: 'planner_timeout',
        ms: 901,
        rationale: null,
      }),
    );
    expect(histograms[`${PLANNER_LATENCY_MS}{source=policy}`]).toEqual([901]);
  });
});
