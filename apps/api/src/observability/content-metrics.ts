import type { MoveKind } from '@aria/shared';

import type { Logger } from '@/lib/logger';
import type { Metrics } from '@/observability/metrics';

export const FALLBACK_USED_TOTAL = 'fallback_used_total';

/**
 * Why a child heard a reviewed static string instead of generated text (P2H-02).
 *
 * The three reasons are distinct on purpose: `ai_disabled` is a deployment choice,
 * `provider_error` is an outage, and `gate_failed` is a quality problem in our own prompts.
 * Collapsing them would hide the only one we can fix by writing a better prompt.
 */
export type FallbackReason = 'ai_disabled' | 'provider_error' | 'gate_failed';

export type TurnContentObserver = Readonly<{
  fallbackUsed(move: MoveKind, reason: FallbackReason): void;
}>;

export function createTurnContentObserver(deps: {
  metrics: Metrics;
  logger: Pick<Logger, 'warn'>;
}): TurnContentObserver {
  return {
    fallbackUsed: (move, reason) => {
      deps.metrics.increment(FALLBACK_USED_TOTAL, { move, reason });
      deps.logger.warn({ event: 'fallback_used', move, reason }, 'Static fallback text was used');
    },
  };
}

/** A no-op observer for call sites that do not report (tests, scripts). */
export const NULL_TURN_CONTENT_OBSERVER: TurnContentObserver = {
  fallbackUsed: () => undefined,
};
