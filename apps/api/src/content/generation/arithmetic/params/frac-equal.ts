import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';

/**
 * Pairs that are equal because they are the same amount written twice, and pairs that are not.
 *
 * Both halves are needed. A bank of only-equal pairs teaches a child to answer equal without
 * looking, and the misconception this skill is really about — different numerals must mean
 * different amounts — can only be caught on a pair that is equal and does not look it.
 */
type Fraction = readonly [numerator: number, denominator: number];
type Pair = Readonly<{ left: Fraction; right: Fraction; equal: boolean }>;

const PAIRS: readonly Pair[] = Array.from({ length: 7 }, (_u, index) => index + 2)
  .flatMap((denominator) =>
    Array.from({ length: denominator - 1 }, (_v, offset) => offset + 1).map(
      (numerator): readonly Pair[] => [
        {
          left: [numerator, denominator],
          right: [numerator * 2, denominator * 2],
          equal: true,
        },
        {
          left: [numerator, denominator],
          right: [numerator, denominator + 1],
          equal: false,
        },
      ],
    ),
  )
  .flat();

export const FRAC_EQUAL_PARAMS: GeneratorParams = {
  skillCode: 'FRAC.EQUAL',
  size: PAIRS.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const pair = PAIRS[index];
  if (pair === undefined) return null;
  return {
    problem: {
      skillCode: 'FRAC.EQUAL',
      kind: 'fraction-equality',
      left: text(pair.left),
      right: text(pair.right),
    },
    answer: pair.equal ? 'equal' : 'not equal',
  };
}

function text(fraction: Fraction): string {
  return `${String(fraction[0])}/${String(fraction[1])}`;
}
