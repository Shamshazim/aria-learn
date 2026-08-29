import { describe, expect, it, vi } from 'vitest';

import { createAiClient, type AiClient } from '@/ai';
import { createModelGrader, type JudgeFallbackReason } from '@/ai/grader/model-grader';
import type { LlmResponse } from '@/ai/provider';
import { scrubLearnerContext } from '@/privacy';

const CONTEXT = scrubLearnerContext(
  { identifiers: {}, gradeBand: 'middle' },
  { pseudonym: 'omit' },
);

const INPUT = {
  question: 'Round 468 to the nearest ten and to the nearest one hundred.',
  expectedAnswer: '470 and 500',
  learnerAnswer: 'five hundred and four hundred seventy',
  context: CONTEXT,
  studentId: 'student-1',
};

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

describe('the model grader', () => {
  it('returns the verdict the FAST tier gives for a spoken answer in other words', async () => {
    const judge = createModelGrader({
      ai: clientOver(() => Promise.resolve(response({ verdict: 'correct', feedback: 'Yes.' }))),
    });

    await expect(judge(INPUT)).resolves.toBe('correct');
  });

  it('has no opinion without a model', async () => {
    const reasons: JudgeFallbackReason[] = [];
    const judge = createModelGrader({ ai: null, onFallback: (reason) => reasons.push(reason) });

    await expect(judge(INPUT)).resolves.toBeNull();
    expect(reasons).toEqual(['disabled']);
  });

  it('has no opinion when the model overruns its budget', async () => {
    const reasons: JudgeFallbackReason[] = [];
    const judge = createModelGrader({
      ai: clientOver(() => new Promise(() => undefined)),
      budgetMs: 5,
      onFallback: (reason) => reasons.push(reason),
    });

    await expect(judge(INPUT)).resolves.toBeNull();
    expect(reasons).toEqual(['timeout']);
  });

  it('has no opinion when the model fails or answers nonsense', async () => {
    const reasons: JudgeFallbackReason[] = [];
    const judge = createModelGrader({
      ai: clientOver(() => Promise.resolve(response({ verdict: 'maybe' }))),
      onFallback: (reason) => reasons.push(reason),
    });

    await expect(judge(INPUT)).resolves.toBeNull();
    expect(reasons).toEqual(['provider_error']);
  });
});
