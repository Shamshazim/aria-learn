import { parseInteger } from '@/quality/arithmetic/normalise';
import { integerVerdict } from '@/quality/arithmetic/solvers/addition';
import { normaliseComparison } from '@/quality/arithmetic/solvers/comparison';
import type {
  AbsoluteValueProblem,
  CheckResult,
  IntegerComparisonProblem,
  IntegerOperation,
  IntegerOperationProblem,
} from '@/quality/arithmetic/types';

/** P3-07: integers, exact on `bigint`. "-5", "−5", "negative five" and "minus 5" are one answer. */
export function solveIntegerComparison(
  problem: IntegerComparisonProblem,
  candidate: string,
): CheckResult {
  const left = parseInteger(problem.left);
  const right = parseInteger(problem.right);
  if (left === null || right === null) {
    return { verdict: 'undecidable', reason: 'Integer comparison needs two integers.' };
  }
  const expected = left < right ? '<' : left > right ? '>' : '=';
  return normaliseComparison(candidate) === expected
    ? { verdict: 'correct', expected, reason: 'Exact integer comparison matches.' }
    : { verdict: 'incorrect', expected, reason: 'Exact integer comparison differs.' };
}

export function solveAbsoluteValue(problem: AbsoluteValueProblem, candidate: string): CheckResult {
  const number = parseInteger(problem.number);
  if (number === null)
    return { verdict: 'undecidable', reason: 'Absolute value needs an integer.' };
  const expected = number < 0n ? -number : number;
  const answer = parseInteger(candidate);
  if (answer === null) {
    return { verdict: 'incorrect', expected: expected.toString(), reason: 'Not an integer.' };
  }
  return integerVerdict(expected, answer, 'absolute value');
}

export function solveIntegerOperation(
  problem: IntegerOperationProblem,
  candidate: string,
): CheckResult {
  const left = parseInteger(problem.left);
  const right = parseInteger(problem.right);
  if (left === null || right === null) {
    return { verdict: 'undecidable', reason: 'Integer operations need two integers.' };
  }
  const truth = integerResult(problem.operation, left, right);
  if (truth === null) {
    return { verdict: 'undecidable', reason: 'This division does not come out whole.' };
  }
  const answer = parseInteger(candidate);
  if (answer === null) {
    return { verdict: 'incorrect', expected: truth.toString(), reason: 'Not an integer.' };
  }
  return integerVerdict(truth, answer, 'integer result');
}

/** The exact result, or `null` for a division that is not whole (or by zero). */
export function integerResult(
  operation: IntegerOperation,
  left: bigint,
  right: bigint,
): bigint | null {
  switch (operation) {
    case 'add':
      return left + right;
    case 'subtract':
      return left - right;
    case 'multiply':
      return left * right;
    case 'divide':
      return right === 0n || left % right !== 0n ? null : left / right;
  }
}
