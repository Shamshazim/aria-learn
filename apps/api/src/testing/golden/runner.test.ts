import { expect, it } from 'vitest';

import { runGoldenSet } from '@/testing/golden/runner';
import type { GoldenItem, GoldenSource } from '@/testing/golden/types';

const item: GoldenItem = {
  id: 'broken-addition',
  subject: 'arithmetic',
  skillCode: 'ADD.FACT.10',
  band: 'early',
  origin: 'model',
  promptName: 'practice-item',
  input: { skill: 'Make an item for 2 + 2.', difficulty: 'same' },
  expectation: {
    arithmeticProblem: { skillCode: 'ADD.FACT.10', kind: 'addition', left: '2', right: '2' },
    multipleChoice: true,
  },
  humanReview: { status: 'approved', notes: 'Checked arithmetic and wording.' },
};

/** These cases are all `model` origin, so the generator side is never reached. */
const UNUSED_GENERATOR: GoldenSource = {
  generate: () => Promise.reject(new Error('generator source should not run for a model case')),
};

it('reports latency, cost and the ids behind a broken answer', async () => {
  const source: GoldenSource = {
    generate: () =>
      Promise.resolve({
        prompt: 'What is two plus two?',
        answer: '5',
        endpointName: 'test-endpoint',
        model: 'test-model',
        latencyMs: 20,
        costUsd: 0.01,
        options: [
          { id: 'a', text: '3' },
          { id: 'b', text: '5' },
          { id: 'c', text: '6' },
        ],
        answerKey: 'b',
      }),
  };

  const report = await runGoldenSet({
    endpointName: 'test-endpoint',
    promptVersion: '1.0.0',
    items: [item],
    source,
    generator: UNUSED_GENERATOR,
  });

  expect(report.checks.arithmetic_correctness.failingItemIds).toEqual(['broken-addition']);
  expect(report).toMatchObject({
    meanLatencyMs: 20,
    p95LatencyMs: 20,
    totalCostUsd: 0.01,
    passed: false,
  });
});

it('turns a malformed provider output into named failed checks instead of stopping the run', async () => {
  const report = await runGoldenSet({
    endpointName: 'test-endpoint',
    promptVersion: '1.0.0',
    items: [item],
    source: { generate: () => Promise.reject(new Error('malformed')) },
    generator: UNUSED_GENERATOR,
  });

  expect(report.checks.arithmetic_correctness.failingItemIds).toEqual(['broken-addition']);
});
