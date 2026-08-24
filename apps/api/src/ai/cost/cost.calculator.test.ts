import { describe, expect, it } from 'vitest';

import { calculateCostUsd } from '@/ai/cost/cost.calculator';

describe('calculateCostUsd', () => {
  it.each([
    { name: 'OpenAI-compatible price', input: 120, output: 30, expected: 0.000_54 },
    { name: 'Anthropic price', input: 1_000, output: 500, expected: 0.006 },
  ])('computes $name from fixed token counts', ({ input, output, expected }) => {
    expect(calculateCostUsd(input, output, { inputPerMillion: 3, outputPerMillion: 6 })).toBe(
      expected,
    );
  });
});
