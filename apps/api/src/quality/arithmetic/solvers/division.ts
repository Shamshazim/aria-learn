import {
  compareRationals,
  parseInteger,
  parseRational,
  rationalToString,
} from '@/quality/arithmetic/normalise';
import type { BinaryOperationProblem, CheckResult, Rational } from '@/quality/arithmetic/types';

export function solveDivision(problem: BinaryOperationProblem, candidate: string): CheckResult {
  const dividend = parseInteger(problem.left);
  const divisor = parseInteger(problem.right);
  const answer = parseRational(candidate, true);
  if (dividend === null || divisor === null || answer === null || divisor === 0n) {
    return { verdict: 'undecidable', reason: 'Division requires a non-zero whole-number divisor.' };
  }

  const expected: Rational = { numerator: dividend, denominator: divisor };
  const reduced = parseRational(`${dividend.toString()}/${divisor.toString()}`, false) ?? expected;
  const expectedText = rationalToString(reduced);
  return compareRationals(expected, answer) === 0
    ? { verdict: 'correct', expected: expectedText, reason: 'Exact rational quotient matches.' }
    : { verdict: 'incorrect', expected: expectedText, reason: 'Exact rational quotient differs.' };
}
