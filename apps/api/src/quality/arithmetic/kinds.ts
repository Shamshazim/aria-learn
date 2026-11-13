import type { ArithmeticProblem } from '@/quality/arithmetic/types';

/** The kinds whose numbers are fractions, decimals or percents rather than whole numbers. */
export type RationalProblem = Extract<
  ArithmeticProblem,
  {
    kind:
      | 'fraction-equality'
      | 'fraction-comparison'
      | 'fraction-missing'
      | 'fraction-operation'
      | 'decimal-place'
      | 'decimal-comparison'
      | 'decimal-operation'
      | 'percent-of';
  }
>;

export type WholeNumberProblem = Exclude<ArithmeticProblem, RationalProblem>;

/**
 * P3-07: one split the dispatchers share, so each half stays readable and a new kind lands in
 * exactly one of them.
 */
export function isRationalProblem(problem: ArithmeticProblem): problem is RationalProblem {
  return (
    problem.kind.startsWith('fraction-') ||
    problem.kind.startsWith('decimal-') ||
    problem.kind === 'percent-of'
  );
}
