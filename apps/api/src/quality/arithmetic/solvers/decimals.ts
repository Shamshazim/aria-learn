import { formatDecimal } from '@/quality/arithmetic/decimal-format';
import { readFraction } from '@/quality/arithmetic/fraction-format';
import { compareRationals, parseInteger, parseRational } from '@/quality/arithmetic/normalise';
import { integerVerdict } from '@/quality/arithmetic/solvers/addition';
import { normaliseComparison } from '@/quality/arithmetic/solvers/comparison';
import { operate } from '@/quality/arithmetic/solvers/fraction-operations';
import type {
  CheckResult,
  DecimalComparisonProblem,
  DecimalOperationProblem,
  DecimalPlaceProblem,
  PercentOfProblem,
  Rational,
} from '@/quality/arithmetic/types';

/**
 * P3-07: decimals and percent, exact on rationals. "4.6", "4.60" and "4 3/5" are one number;
 * nothing here goes through floating point, so 0.1 + 0.2 is 0.3 and nothing else.
 */
export function solveDecimalPlace(problem: DecimalPlaceProblem, candidate: string): CheckResult {
  const match = /^\s*(\d+)\.(\d+)\s*$/u.exec(problem.number);
  const answer = parseInteger(candidate);
  if (match === null) {
    return { verdict: 'undecidable', reason: 'Decimal place value needs a decimal number.' };
  }
  const digit = (match[2] ?? '')[problem.place === 'tenths' ? 0 : 1];
  if (digit === undefined) {
    return { verdict: 'undecidable', reason: 'The number has no digit in that place.' };
  }
  if (answer === null) return { verdict: 'incorrect', expected: digit, reason: 'Not a digit.' };
  return integerVerdict(BigInt(digit), answer, 'decimal digit');
}

export function solveDecimalComparison(
  problem: DecimalComparisonProblem,
  candidate: string,
): CheckResult {
  const left = parseRational(problem.left, true);
  const right = parseRational(problem.right, true);
  if (left === null || right === null) {
    return { verdict: 'undecidable', reason: 'Decimal comparison needs two decimals.' };
  }
  const truth = compareRationals(left, right);
  const expected = truth < 0 ? '<' : truth > 0 ? '>' : '=';
  return normaliseComparison(candidate) === expected
    ? { verdict: 'correct', expected, reason: 'Exact decimal comparison matches.' }
    : { verdict: 'incorrect', expected, reason: 'Exact decimal comparison differs.' };
}

export function solveDecimalOperation(
  problem: DecimalOperationProblem,
  candidate: string,
): CheckResult {
  const left = parseRational(problem.left, true);
  const right = parseRational(problem.right, true);
  if (left === null || right === null) {
    return { verdict: 'undecidable', reason: 'Decimal operations need two decimals.' };
  }
  return rationalVerdict(operate(problem.operation, left, right), candidate);
}

export function solvePercentOf(problem: PercentOfProblem, candidate: string): CheckResult {
  const percent = parseRational(problem.percent.replace(/%$/u, ''), true);
  const whole = parseRational(problem.whole, true);
  if (percent === null || whole === null) {
    return { verdict: 'undecidable', reason: 'Percent of needs a percent and a whole.' };
  }
  const truth = operate('multiply', percent, {
    numerator: whole.numerator,
    denominator: whole.denominator * 100n,
  });
  return rationalVerdict(truth, candidate);
}

function rationalVerdict(truth: Rational, candidate: string): CheckResult {
  const expected =
    formatDecimal(truth) ?? `${truth.numerator.toString()}/${truth.denominator.toString()}`;
  const answer = readFraction(candidate);
  return answer !== null && compareRationals(truth, answer) === 0
    ? { verdict: 'correct', expected, reason: 'Exact rational result matches.' }
    : { verdict: 'incorrect', expected, reason: 'Exact rational result differs.' };
}
