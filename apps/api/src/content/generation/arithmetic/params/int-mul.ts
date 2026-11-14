import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';

/**
 * Multiplying and dividing integers (7.NS.A.2): the times tables to ten with at least one
 * negative, and the divisions that undo them, exact. Both-positive facts are `MUL.FACT.10`'s.
 */
type Entry = readonly ['multiply' | 'divide', number, number, number];

const FACTORS = Array.from({ length: 19 }, (_u, index) => index - 9).filter(
  (value) => Math.abs(value) >= 2,
);

const ENTRIES: readonly Entry[] = FACTORS.flatMap((left) =>
  FACTORS.filter((right) => left < 0 || right < 0).flatMap((right): Entry[] => [
    ['multiply', left, right, left * right],
    ['divide', left * right, right, left],
  ]),
);

export const INT_MUL_PARAMS: GeneratorParams = {
  skillCode: 'INT.MUL',
  size: ENTRIES.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const entry = ENTRIES[index];
  if (entry === undefined) return null;
  const [operation, left, right, answer] = entry;
  return {
    problem: {
      skillCode: 'INT.MUL',
      kind: 'integer-operation',
      operation,
      left: String(left),
      right: String(right),
    },
    answer: String(answer),
  };
}
