import { parseInteger } from '@/quality/arithmetic/normalise';
import { integerVerdict } from '@/quality/arithmetic/solvers/addition';
import type { BinaryOperationProblem, CheckResult } from '@/quality/arithmetic/types';

export function solveMultiplication(
  problem: BinaryOperationProblem,
  candidate: string,
): CheckResult {
  const left = parseInteger(problem.left);
  const right = parseInteger(problem.right);
  const answer = parseInteger(candidate);
  if (left === null || right === null || answer === null) {
    return { verdict: 'undecidable', reason: 'Multiplication requires whole-number operands.' };
  }
  return integerVerdict(left * right, answer, 'product');
}
