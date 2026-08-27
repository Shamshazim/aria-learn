import type { MoveKind } from '@aria/shared';

import type { Logger } from '@/lib/logger';
import type { Metrics } from '@/observability/metrics';

export const FALLBACK_USED_TOTAL = 'fallback_used_total';
export const STREAM_TRUNCATED_TOTAL = 'stream_truncated_total';

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
  /**
   * P2H-07: the child heard part of an answer and then the stream stopped.
   *
   * It is not a fallback — the sentences they did hear were Aria's own, and they were gated.
   * It is not a success either, so it gets its own counter rather than hiding inside the one
   * that means "we never generated anything at all".
   */
  streamTruncated(move: MoveKind, reason: FallbackReason, error: unknown): void;
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
    streamTruncated: (move, reason, error) => {
      deps.metrics.increment(STREAM_TRUNCATED_TOTAL, { move, reason });
      deps.logger.warn(
        { event: 'stream_truncated', move, reason, err: error },
        'A streamed answer stopped after the child had already heard part of it',
      );
    },
  };
}

/** A no-op observer for call sites that do not report (tests, scripts). */
export const NULL_TURN_CONTENT_OBSERVER: TurnContentObserver = {
  fallbackUsed: () => undefined,
  streamTruncated: () => undefined,
};
