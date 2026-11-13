import type { ArithmeticProblem } from '@/quality/arithmetic/types';

/**
 * The numbers a problem is made of, as written (P3-07). One answer, so the word-problem check,
 * the reveal's working line and anything else that asks "which numbers is this about" cannot
 * disagree — and a new problem kind is a compile error here rather than a silent gap there.
 */
export function problemNumbers(problem: ArithmeticProblem): readonly string[] {
  switch (problem.kind) {
    case 'sequence':
      return [...problem.values, problem.step];
    case 'place-value':
    case 'rounding':
      return [problem.number];
    case 'addition':
    case 'subtraction':
    case 'fraction-equality':
    case 'fraction-comparison':
    case 'whole-comparison':
      return [problem.left, problem.right];
  }
}
