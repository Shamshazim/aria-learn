import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';

/**
 * Two-digit sums that actually need a trade.
 *
 * The filter is the skill: a pair whose ones column does not reach ten is a different skill
 * wearing this one's name, and would let a child pass without ever regrouping. Totals stay
 * inside two digits so the hundreds column never appears.
 */
const PAIRS: readonly (readonly [number, number])[] = Array.from({ length: 90 }, (_u, left) =>
  Array.from({ length: 90 }, (_v, right): readonly [number, number] => [left + 10, right + 10]),
)
  .flat()
  .filter(([left, right]) => (left % 10) + (right % 10) >= 10 && left + right <= 99);

export const ADD_REGROUP_2D_PARAMS: GeneratorParams = {
  skillCode: 'ADD.REGROUP.2D',
  size: PAIRS.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const pair = PAIRS[index];
  if (pair === undefined) return null;
  const [left, right] = pair;
  return {
    problem: {
      skillCode: 'ADD.REGROUP.2D',
      kind: 'addition',
      left: String(left),
      right: String(right),
    },
    answer: String(left + right),
  };
}
