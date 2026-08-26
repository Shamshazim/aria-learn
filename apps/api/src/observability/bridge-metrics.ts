import type { Band, VoiceMetric } from '@aria/shared';

import type { Metrics } from '@/observability/metrics';

export const BRIDGE_PLAYED_TOTAL = 'bridge_played_total';
export const BRIDGE_SKIPPED_TOTAL = 'bridge_skipped_total';
export const BRIDGE_REPEAT_TOTAL = 'bridge_repeat_total';

type BridgeMetric = Extract<VoiceMetric, { kind: 'bridge' }>;

/**
 * What the bridge path did, per turn (P2H-09).
 *
 * The skip counter is labelled by rule because the interesting failure is not "bridges are
 * rare" but *which* rule is making them rare: `segment-imminent` climbing means P2H-07 got
 * fast enough that bridges are no longer needed, and `no-clip` climbing means a library nobody
 * ever recorded. Those two look identical in a total.
 */
export function createBridgeObserver(deps: {
  metrics: Metrics;
}): (input: Readonly<{ band: Band; metric: BridgeMetric }>) => void {
  return ({ band, metric }) => {
    if (metric.played) {
      deps.metrics.increment(BRIDGE_PLAYED_TOTAL, { band, bucket: metric.bucket ?? 'unknown' });
    } else {
      deps.metrics.increment(BRIDGE_SKIPPED_TOTAL, { rule: metric.rule ?? 'unknown' });
    }
    if (metric.repeat) deps.metrics.increment(BRIDGE_REPEAT_TOTAL, { band });
  };
}
