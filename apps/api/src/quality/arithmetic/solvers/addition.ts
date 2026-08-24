import { parseInteger } from '@/quality/arithmetic/normalise';
import type { AdditionProblem, CheckResult } from '@/quality/arithmetic/types';

export function solveAddition(problem: AdditionProblem, candidate: string): CheckResult {
  const left = parseInteger(problem.left);
  const right = parseInteger(problem.right);
  const answer = parseInteger(candidate);
  if (left === null || right === null || answer === null) {
    return { verdict: 'undecidable', reason: 'Addition requires whole-number operands.' };
  }

  return integerVerdict(left + right, answer, 'sum');
}

export function integerVerdict(expected: bigint, answer: bigint, operation: string): CheckResult {
  return answer === expected
    ? {
        verdict: 'correct',
        expected: expected.toString(),
        reason: `Exact integer ${operation} matches.`,
      }
    : {
        verdict: 'incorrect',
        expected: expected.toString(),
        reason: `Exact integer ${operation} differs.`,
      };
}
