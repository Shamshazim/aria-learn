import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';

/**
 * Two-digit subtraction that needs a trade (2.NBT.B.5): the ones digit on top is smaller than
 * the one below, so a ten has to be broken. Both numbers have two digits and the answer is at
 * least ten, so the tens column always has work left in it after the trade.
 *
 * The filter is the skill, as in `ADD.REGROUP.2D`: without it "subtract the smaller digit from
 * the bigger" would pass, which is the commonest wrong idea in the strand.
 */
const PAIRS: readonly (readonly [number, number])[] = Array.from({ length: 70 }, (_u, left) =>
  Array.from({ length: 80 }, (_v, right): readonly [number, number] => [left + 30, right + 11]),
)
  .flat()
  .filter(([left, right]) => left % 10 < right % 10 && left - right >= 10);

export const SUB_REGROUP_2D_PARAMS: GeneratorParams = {
  skillCode: 'SUB.REGROUP.2D',
  size: PAIRS.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const pair = PAIRS[index];
  if (pair === undefined) return null;
  const [left, right] = pair;
  return {
    problem: {
      skillCode: 'SUB.REGROUP.2D',
      kind: 'subtraction',
      left: String(left),
      right: String(right),
    },
    answer: String(left - right),
  };
}
