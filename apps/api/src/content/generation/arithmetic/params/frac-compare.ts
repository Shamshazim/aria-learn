import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';

/**
 * Same-denominator pairs, in every order including equal.
 *
 * The denominator is shared because that is what the skill says: comparing fractions with
 * unlike denominators is a later skill, and generating one here would hand a child a problem
 * the lesson note has not taught them.
 */
type Pair = readonly [left: number, right: number, denominator: number];

const PAIRS: readonly Pair[] = Array.from({ length: 9 }, (_u, index) => index + 2).flatMap(
  (denominator) =>
    Array.from({ length: denominator }, (_v, left) => left + 1).flatMap((left) =>
      Array.from({ length: denominator }, (_w, right): Pair => [left, right + 1, denominator]),
    ),
);

export const FRAC_COMPARE_PARAMS: GeneratorParams = {
  skillCode: 'FRAC.COMPARE',
  size: PAIRS.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const pair = PAIRS[index];
  if (pair === undefined) return null;
  const [left, right, denominator] = pair;
  return {
    problem: {
      skillCode: 'FRAC.COMPARE',
      kind: 'fraction-comparison',
      left: `${String(left)}/${String(denominator)}`,
      right: `${String(right)}/${String(denominator)}`,
    },
    answer: left < right ? '<' : left > right ? '>' : '=',
  };
}
