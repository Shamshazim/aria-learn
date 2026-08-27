import type { Logger } from '@/lib/logger';
import type { Metrics } from '@/observability/metrics';
import type { GateObserver, GateRejection } from '@/quality/gate.observer';

export const GATE_REJECTIONS_TOTAL = 'gate_rejections_total';

/**
 * Turns a gate rejection into exactly one structured log line and one counter increment
 * (P2H-02). Labels are bounded — check, code and band are all closed sets — so the counter
 * cannot explode into a cardinality problem.
 */
export function createGateObserver(deps: {
  metrics: Metrics;
  logger: Pick<Logger, 'warn'>;
}): GateObserver {
  return (rejection: GateRejection) => {
    deps.metrics.increment(GATE_REJECTIONS_TOTAL, {
      check: rejection.check,
      code: rejection.code,
      band: rejection.band,
    });
    deps.logger.warn(
      {
        event: 'gate_rejection',
        contentId: rejection.id,
        band: rejection.band,
        inputKind: rejection.inputKind,
        check: rejection.check,
        code: rejection.code,
        codes: rejection.codes,
      },
      rejection.message,
    );
  };
}
