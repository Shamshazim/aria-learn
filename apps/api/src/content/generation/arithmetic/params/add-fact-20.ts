import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';

/**
 * Addition facts that cross ten (2.OA.B.2): both addends 2–10, total 11–20.
 *
 * Totals of ten or less are `ADD.FACT.10`'s; a fact that does not cross ten would let a child
 * pass this skill without ever making a ten, which is the strategy the skill exists to build.
 */
const PAIRS: readonly (readonly [number, number])[] = Array.from({ length: 9 }, (_u, left) =>
  Array.from({ length: 9 }, (_v, right): readonly [number, number] => [left + 2, right + 2]),
)
  .flat()
  .filter(([left, right]) => left + right >= 11);

export const ADD_FACT_20_PARAMS: GeneratorParams = {
  skillCode: 'ADD.FACT.20',
  size: PAIRS.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const pair = PAIRS[index];
  if (pair === undefined) return null;
  const [left, right] = pair;
  return {
    problem: {
      skillCode: 'ADD.FACT.20',
      kind: 'addition',
      left: String(left),
      right: String(right),
    },
    answer: String(left + right),
  };
}
