import {
  isAlgebraProblem,
  isSignedOrRatioProblem,
  type AlgebraProblem,
  type SignedOrRatioProblem,
} from '@/quality/arithmetic/kinds';
import type { ArithmeticProblem } from '@/quality/arithmetic/types';

/**
 * The numbers a problem is made of, as written (P3-07). One answer, so the word-problem check,
 * the reveal's working line and anything else that asks "which numbers is this about" cannot
 * disagree — and a new problem kind is a compile error here rather than a silent gap there.
 */
export function problemNumbers(problem: ArithmeticProblem): readonly string[] {
  if (problem.kind === 'sequence') return [...problem.values, problem.step];
  if (isAlgebraProblem(problem)) return algebraNumbers(problem);
  if (isSignedOrRatioProblem(problem)) return signedOrRatioNumbers(problem);
  if ('number' in problem) return [problem.number];
  if (problem.kind === 'fraction-missing') return [problem.left, problem.denominator];
  if (problem.kind === 'percent-of') return [problem.percent, problem.whole];
  // Every kind left has two operands; one that does not fails to compile here.
  return [problem.left, problem.right];
}

function algebraNumbers(problem: AlgebraProblem): readonly string[] {
  switch (problem.kind) {
    case 'expression':
      return numbersIn(problem.expression);
    case 'expression-value':
      return [...numbersIn(problem.expression), problem.value];
    case 'equation':
      return [...numbersIn(problem.left), ...numbersIn(problem.right)];
  }
}

function signedOrRatioNumbers(problem: SignedOrRatioProblem): readonly string[] {
  switch (problem.kind) {
    case 'absolute-value':
      return [problem.number];
    case 'integer-comparison':
    case 'integer-operation':
      return [problem.left, problem.right];
    case 'ratio-missing':
      return [problem.first, problem.second, problem.scaledFirst];
    case 'unit-rate':
      return [problem.amount, problem.per];
    case 'proportion':
      return [problem.count, problem.total, problem.asked];
  }
}

function numbersIn(text: string): readonly string[] {
  return [...text.matchAll(/\d+/gu)].map((match) => match[0]);
}
