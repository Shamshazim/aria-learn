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

/** The grade 6–7 kinds that are neither plain whole numbers nor fractions: signs and ratios. */
export type SignedOrRatioProblem = Extract<
  ArithmeticProblem,
  {
    kind:
      | 'integer-comparison'
      | 'absolute-value'
      | 'integer-operation'
      | 'ratio-missing'
      | 'unit-rate'
      | 'proportion';
  }
>;

/** Expressions and equations, with letters in them. */
export type AlgebraProblem = Extract<
  ArithmeticProblem,
  { kind: 'expression' | 'expression-value' | 'equation' }
>;

/** Measurement and data: time, money, shapes, units and averages. */
export type MeasureProblem = Extract<
  ArithmeticProblem,
  { kind: 'elapsed-time' | 'money-change' | 'rectangle' | 'unit-conversion' | 'statistic' }
>;

export type WholeNumberProblem = Exclude<
  ArithmeticProblem,
  RationalProblem | SignedOrRatioProblem | AlgebraProblem | MeasureProblem
>;

const MEASURE_KINDS: ReadonlySet<string> = new Set([
  'elapsed-time',
  'money-change',
  'rectangle',
  'unit-conversion',
  'statistic',
]);

export function isMeasureProblem(problem: ArithmeticProblem): problem is MeasureProblem {
  return MEASURE_KINDS.has(problem.kind);
}

export function isAlgebraProblem(problem: ArithmeticProblem): problem is AlgebraProblem {
  return (
    problem.kind === 'expression' ||
    problem.kind === 'expression-value' ||
    problem.kind === 'equation'
  );
}

const SIGNED_OR_RATIO_KINDS: ReadonlySet<string> = new Set([
  'integer-comparison',
  'absolute-value',
  'integer-operation',
  'ratio-missing',
  'unit-rate',
  'proportion',
]);

export function isSignedOrRatioProblem(
  problem: ArithmeticProblem,
): problem is SignedOrRatioProblem {
  return SIGNED_OR_RATIO_KINDS.has(problem.kind);
}

/**
 * P3-07: the splits the dispatchers share — fractions and decimals, signs and ratios, algebra,
 * and whole numbers — so each part stays readable and a new kind lands in exactly one of them.
 */
export function isRationalProblem(problem: ArithmeticProblem): problem is RationalProblem {
  return (
    problem.kind.startsWith('fraction-') ||
    problem.kind.startsWith('decimal-') ||
    problem.kind === 'percent-of'
  );
}
