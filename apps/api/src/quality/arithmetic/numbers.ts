import type { ArithmeticProblem } from '@/quality/arithmetic/types';

/**
 * The numbers a problem is made of, as written (P3-07). One answer, so the word-problem check,
 * the reveal's working line and anything else that asks "which numbers is this about" cannot
 * disagree — and a new problem kind is a compile error here rather than a silent gap there.
 */
export function problemNumbers(problem: ArithmeticProblem): readonly string[] {
  if (problem.kind === 'sequence') return [...problem.values, problem.step];
  if (problem.kind === 'place-value' || problem.kind === 'rounding') return [problem.number];
  if (problem.kind === 'decimal-place') return [problem.number];
  if (problem.kind === 'percent-of') return [problem.percent, problem.whole];
  if (problem.kind === 'fraction-missing') return [problem.left, problem.denominator];
  // Every kind left has two operands; one that does not fails to compile here.
  return [problem.left, problem.right];
}
