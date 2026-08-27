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
    // The rationale is deliberately absent: it is free text written about what a child just
    // said, so it stays in `session_event.evidence`, behind the same access as the transcript,
    // and never reaches a log aggregator (CODE-STANDARDS §5).
    deps.logger.info(
      {
        event: 'planner_decision',
        sessionId: observation.sessionId,
        allowedMoves: observation.allowedMoves,
        proposed: observation.proposed,
        accepted: observation.accepted,
        source: observation.source,
        reason: observation.reason,
        ...(observation.error === null ? {} : { error: observation.error }),
        ms: observation.ms,
      },
      'planner decision',
    );
  };
}
