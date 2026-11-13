import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';

/**
 * A two-digit number times a one-digit number, with a carry (4.NBT.B.5).
 *
 * The ones product reaches ten every time, so the carried tens are part of every item: without
 * it "multiply each digit and write them side by side" would pass. Multiples of ten are out,
 * because there the method is a shortcut, not the method.
 */
const PAIRS: readonly (readonly [number, number])[] = Array.from({ length: 88 }, (_u, left) =>
  Array.from({ length: 7 }, (_v, right): readonly [number, number] => [left + 12, right + 3]),
)
  .flat()
  .filter(([left, right]) => left % 10 !== 0 && (left % 10) * right >= 10);

export const MUL_2D1D_PARAMS: GeneratorParams = {
  skillCode: 'MUL.2D1D',
  size: PAIRS.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const pair = PAIRS[index];
  if (pair === undefined) return null;
  const [left, right] = pair;
  return {
    problem: {
      skillCode: 'MUL.2D1D',
      kind: 'multiplication',
      left: String(left),
      right: String(right),
    },
    answer: String(left * right),
  };
}
