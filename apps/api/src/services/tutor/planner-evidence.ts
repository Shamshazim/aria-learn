import type { PlannerObservation } from '@aria/tutor';

import type { Logger } from '@/lib/logger';
import type { Metrics } from '@/observability/metrics';

export const PLANNER_DECISION_TOTAL = 'planner_decision_total';
export const PLANNER_LATENCY_MS = 'planner_latency_ms';

/** Reasons the planner was never asked. Counting them apart keeps the latency honest. */
const NOT_ASKED = new Set(['policy_decisive', 'single_allowed_move']);

/**
 * Every planner decision, written down (P2H-06).
 *
 * The turn's own evidence records what happened to a child; this records what the system was
 * willing to let happen: the set, the proposal, whether it survived, and how long it cost. A
 * rising `planner-rejected` rate means the prompt and the policy disagree about the situation,
 * and that is a prompt bug, not a model to trust less.
 */
export function createPlannerObserver(deps: {
  metrics: Metrics;
  logger: Pick<Logger, 'info'>;
}): (observation: PlannerObservation) => void {
  return (observation) => {
    deps.metrics.increment(PLANNER_DECISION_TOTAL, {
      source: observation.source,
      reason: observation.reason ?? 'accepted',
    });
    if (!NOT_ASKED.has(observation.reason ?? '')) {
      deps.metrics.observe(PLANNER_LATENCY_MS, observation.ms, { source: observation.source });
    }
    deps.logger.info(
      {
        allowedMoves: observation.allowedMoves,
        proposed: observation.proposed,
        accepted: observation.accepted,
        source: observation.source,
        rationale: observation.rationale,
        reason: observation.reason,
        ms: observation.ms,
      },
      'planner decision',
    );
  };
}
