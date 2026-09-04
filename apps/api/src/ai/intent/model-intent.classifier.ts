import {
  classifyIntent,
  MODEL_PASS_CONFIDENCE,
  type IntentHints,
  type IntentResult,
} from '@aria/tutor';

import type { AiClient } from '@/ai';
import type { ScrubbedContext } from '@/privacy';

/**
 * The intent classifier: deterministic rules, then a model second pass when the rules are
 * guessing (P2H-05).
 *
 * The rules' answer is always computed and always available. The model is an improvement on
 * it, never a dependency: it runs only for a low-confidence result, inside a hard budget, and
 * any failure — slow, down, over budget, nonsense output — falls back to the rules and is
 * counted. A turn must never wait on a classifier to find out that a child said "seven".
 * The budget is set above what the FAST endpoint actually takes (0.3–0.6 s); below that the
 * model pass never finishes and the rules decide every uncertain turn.
 */
export const INTENT_MODEL_BUDGET_MS = 1_200;

export type IntentFallbackReason = 'timeout' | 'provider_error' | 'disabled';

export type IntentClassifierDeps = Readonly<{
  ai: AiClient | null;
  budgetMs?: number;
  onFallback?: (reason: IntentFallbackReason) => void;
}>;

export type IntentClassification = IntentResult & Readonly<{ source: 'rules' | 'model' }>;

export type IntentClassifier = Readonly<{
  classify(
    input: Readonly<{
      text: string;
      hints: IntentHints;
      context: ScrubbedContext;
      question: string;
      studentId: string;
    }>,
  ): Promise<IntentClassification>;
}>;

export function createIntentClassifier(deps: IntentClassifierDeps): IntentClassifier {
  return {
    classify: async (input) => {
      const rules = classifyIntent(input.text, input.hints);
      if (rules.confidence >= MODEL_PASS_CONFIDENCE) return { ...rules, source: 'rules' };
      if (deps.ai === null) {
        deps.onFallback?.('disabled');
        return { ...rules, source: 'rules' };
      }
      return runModelPass(deps, deps.ai, input, rules);
    },
  };
}

const TIMED_OUT = Symbol('intent-budget-expired');

async function runModelPass(
  deps: IntentClassifierDeps,
  ai: AiClient,
  input: Parameters<IntentClassifier['classify']>[0],
  rules: IntentResult,
): Promise<IntentClassification> {
  const budgetMs = deps.budgetMs ?? INTENT_MODEL_BUDGET_MS;
  const controller = new AbortController();
  let expired: ReturnType<typeof setTimeout> | undefined;
  // The budget is enforced here, not delegated to the provider. Abort is still sent so the
  // request stops costing money, but a provider that ignores it cannot hold up a child's turn.
  const budget = new Promise<typeof TIMED_OUT>((resolve) => {
    expired = setTimeout(() => {
      controller.abort();
      resolve(TIMED_OUT);
    }, budgetMs);
  });
  try {
    const result = await Promise.race([
      ai.run(
        'classify-intent',
        { context: input.context, utterance: input.text, question: input.question },
        { studentId: input.studentId, signal: controller.signal, timeoutMs: budgetMs },
      ),
      budget,
    ]);
    if (result === TIMED_OUT) {
      deps.onFallback?.('timeout');
      return { ...rules, source: 'rules' };
    }
    return { ...result.data, matchedRule: null, source: 'model' };
  } catch {
    deps.onFallback?.(controller.signal.aborted ? 'timeout' : 'provider_error');
    return { ...rules, source: 'rules' };
  } finally {
    clearTimeout(expired);
  }
}
