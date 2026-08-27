import type { IntentFallbackReason } from '@/ai/intent/model-intent.classifier';
import type { Metrics } from '@/observability/metrics';

export const INTENT_MODEL_FALLBACK_TOTAL = 'intent_model_fallback_total';

/**
 * How often the model second pass could not answer in time (P2H-05).
 *
 * A rising `timeout` rate means the FAST tier is too slow to sit in front of a turn, and the
 * right response is to move the endpoint, not to raise the budget: the budget is what keeps a
 * child from waiting on a classifier.
 */
export function createIntentFallbackObserver(deps: {
  metrics: Metrics;
}): (reason: IntentFallbackReason) => void {
  return (reason) => {
    deps.metrics.increment(INTENT_MODEL_FALLBACK_TOTAL, { reason });
  };
}
