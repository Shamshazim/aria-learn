import { parseInteger } from '@/quality/arithmetic/normalise';
import {
  formatQuotientWithRemainder,
  parseQuotientWithRemainder,
} from '@/quality/arithmetic/remainder';
import type { CheckResult, DivisionProblem } from '@/quality/arithmetic/types';

/**
 * Whole-number division with a remainder (P3-07), exact on `bigint`: the quotient is
 * `left / right` truncated and the remainder is what is left, always below the divisor. An
 * answer with a remainder as big as the divisor ("39 r 4" for 160 ÷ 4) is wrong, not
 * equivalent: one more group was there to be made.
 */
export function solveWholeDivision(problem: DivisionProblem, candidate: string): CheckResult {
  const dividend = parseInteger(problem.left);
  const divisor = parseInteger(problem.right);
  if (dividend === null || divisor === null || divisor <= 0n || dividend < 0n) {
    return {
      verdict: 'undecidable',
      reason: 'Division requires whole numbers and a divisor above zero.',
    };
  }
  const expected = formatQuotientWithRemainder({
    quotient: dividend / divisor,
    remainder: dividend % divisor,
  });
  const answer = parseQuotientWithRemainder(candidate);
  if (answer === null) {
    return { verdict: 'incorrect', expected, reason: 'Not a quotient with a remainder.' };
  }
  const matches = answer.quotient === dividend / divisor && answer.remainder === dividend % divisor;
  return matches
    ? { verdict: 'correct', expected, reason: 'Exact quotient and remainder match.' }
    : { verdict: 'incorrect', expected, reason: 'Exact quotient and remainder differ.' };
}
