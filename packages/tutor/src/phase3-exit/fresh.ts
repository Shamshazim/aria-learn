import { THRESHOLDS } from './thresholds';

import type { Observation } from './types';

const DAY_MS = 86_400_000;

/**
 * The observations that still count: recorded no more than sixty days before the evaluation,
 * and not after it. A future date is a typo, not evidence, and is dropped like a stale one.
 */
export function fresh<T>(
  observations: readonly Observation<T>[],
  evaluatedAt: string,
): readonly Observation<T>[] {
  const now = Date.parse(evaluatedAt);
  return observations.filter((observation) => {
    const at = Date.parse(observation.recordedAt);
    return Number.isFinite(at) && at <= now && now - at <= THRESHOLDS.freshDays * DAY_MS;
  });
}
