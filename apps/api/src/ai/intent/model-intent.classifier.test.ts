import { describe, expect, it, vi } from 'vitest';

import { createAiClient, type AiClient } from '@/ai';
import {
  createIntentClassifier,
  INTENT_MODEL_BUDGET_MS,
  type IntentFallbackReason,
} from '@/ai/intent/model-intent.classifier';
import type { LlmResponse } from '@/ai/provider';
import {
  createIntentFallbackObserver,
  INTENT_MODEL_FALLBACK_TOTAL,
} from '@/observability/intent-metrics';
import { createMetrics } from '@/observability/metrics';
import { scrubLearnerContext } from '@/privacy';

const CONTEXT = scrubLearnerContext(
  { identifiers: {}, gradeBand: 'middle' },
  { pseudonym: 'omit' },
);

function response(body: unknown): LlmResponse {
  return {
    text: JSON.stringify(body),
    endpointName: 'fast-primary',
    model: 'fast-model',
    tokensIn: 20,
    tokensOut: 8,
    costUsd: 0,
    latencyMs: 1,
    finishReason: 'stop',
  };
}

function clientOver(complete: (request: never) => Promise<LlmResponse>): AiClient {
  return createAiClient({
    provider: {
      complete,
      stream: async function* () {
        yield await Promise.resolve({ kind: 'complete', response: response({}) } as const);
      },
    },
    accounting: {
      assertWithinCap: vi.fn(() => Promise.resolve()),
      record: vi.fn(() => Promise.resolve()),
      recordCachedHit: vi.fn(() => Promise.resolve()),
    },
    now: () => 0,
  });
}

function classifierWith(ai: AiClient | null, budgetMs?: number) {
  const metrics = createMetrics();
  const fallbacks: IntentFallbackReason[] = [];
  const observe = createIntentFallbackObserver({ metrics });
  const classifier = createIntentClassifier({
    ai,
    ...(budgetMs === undefined ? {} : { budgetMs }),
    onFallback: (reason) => {
      fallbacks.push(reason);
      observe(reason);
    },
  });
  return { classifier, metrics, fallbacks };
}

/** "im tired today" — no apostrophe, so the first-person rule misses it and the rules guess. */
const LOW_CONFIDENCE = {
  text: 'im tired today',
  hints: { answerKey: '7' },
  context: CONTEXT,
  question: 'What is four plus three?',
  studentId: 'student-1',
};

const CONFIDENT = { ...LOW_CONFIDENCE, text: "i don't get it" };

describe('intent classifier', () => {
  it('never calls the model when the rules already matched a pattern', async () => {
    const complete = vi.fn(() => Promise.resolve(response({ intent: 'CHAT', confidence: 0.9 })));
    const { classifier } = classifierWith(clientOver(complete));

    expect(await classifier.classify(CONFIDENT)).toMatchObject({
      intent: 'CONFUSED',
      source: 'rules',
    });
    expect(complete).not.toHaveBeenCalled();
  });

  it('asks the model when the rules are guessing, and takes its answer', async () => {
    const complete = vi.fn(() => Promise.resolve(response({ intent: 'CHAT', confidence: 0.88 })));
    const { classifier } = classifierWith(clientOver(complete));

    expect(await classifier.classify(LOW_CONFIDENCE)).toMatchObject({
      intent: 'CHAT',
      source: 'model',
    });
    expect(complete).toHaveBeenCalledOnce();
  });

  it('falls back to the rules when the model overruns its budget', async () => {
    const complete = vi.fn(
      () =>
        new Promise<LlmResponse>((resolve) =>
          setTimeout(() => {
            resolve(response({}));
          }, 5_000),
        ),
    );
    const { classifier, metrics, fallbacks } = classifierWith(clientOver(complete), 10);

    const result = await classifier.classify(LOW_CONFIDENCE);

    expect(result).toMatchObject({ intent: 'ANSWER', source: 'rules' });
    expect(fallbacks).toEqual(['timeout']);
    expect(metrics.snapshot().counters).toEqual({
      [`${INTENT_MODEL_FALLBACK_TOTAL}{reason=timeout}`]: 1,
    });
  });

  it('falls back to the rules when the provider fails', async () => {
    const { classifier, fallbacks } = classifierWith(
      clientOver(vi.fn(() => Promise.reject(new Error('safe test failure')))),
    );

    expect(await classifier.classify(LOW_CONFIDENCE)).toMatchObject({ source: 'rules' });
    expect(fallbacks).toEqual(['provider_error']);
  });

  it('falls back to the rules when the model output is not a known intent', async () => {
    const { classifier, fallbacks } = classifierWith(
      clientOver(vi.fn(() => Promise.resolve(response({ intent: 'VIBES', confidence: 1 })))),
    );

    expect(await classifier.classify(LOW_CONFIDENCE)).toMatchObject({ source: 'rules' });
    expect(fallbacks).toEqual(['provider_error']);
  });

  it('uses the rules alone when no model is configured, and says so', async () => {
    const { classifier, fallbacks } = classifierWith(null);

    expect(await classifier.classify(LOW_CONFIDENCE)).toMatchObject({ source: 'rules' });
    expect(fallbacks).toEqual(['disabled']);
  });

  it('keeps the budget in front of the turn, not behind it', () => {
    expect(INTENT_MODEL_BUDGET_MS).toBeLessThanOrEqual(300);
  });
});
