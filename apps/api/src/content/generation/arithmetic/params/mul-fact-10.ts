import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';

/**
 * Multiplication facts to ten times ten (3.OA.C.7). Factors from 2: times one and times zero
 * are rules a child learns once, not facts to retrieve, and would dilute the drill.
 */
const PAIRS: readonly (readonly [number, number])[] = Array.from({ length: 9 }, (_u, left) =>
  Array.from({ length: 9 }, (_v, right): readonly [number, number] => [left + 2, right + 2]),
).flat();

export const MUL_FACT_10_PARAMS: GeneratorParams = {
  skillCode: 'MUL.FACT.10',
  size: PAIRS.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const pair = PAIRS[index];
  if (pair === undefined) return null;
  const [left, right] = pair;
  return {
    problem: {
      skillCode: 'MUL.FACT.10',
      kind: 'multiplication',
      left: String(left),
      right: String(right),
    },
    answer: String(left * right),
  };
}
