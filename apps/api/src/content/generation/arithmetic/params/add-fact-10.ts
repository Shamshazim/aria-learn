import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';

/** Every pair of whole numbers from one that totals ten or less: forty-five facts. */
const PAIRS: readonly (readonly [number, number])[] = Array.from({ length: 9 }, (_u, left) =>
  Array.from({ length: 9 - left }, (_v, right): readonly [number, number] => [left + 1, right + 1]),
).flat();

export const ADD_FACT_10_PARAMS: GeneratorParams = {
  skillCode: 'ADD.FACT.10',
  size: PAIRS.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const pair = PAIRS[index];
  if (pair === undefined) return null;
  const [left, right] = pair;
  return {
    problem: {
      skillCode: 'ADD.FACT.10',
      kind: 'addition',
      left: String(left),
      right: String(right),
    },
    answer: String(left + right),
  };
}
