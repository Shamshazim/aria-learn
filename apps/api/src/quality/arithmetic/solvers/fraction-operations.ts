import { formatFraction, readFraction } from '@/quality/arithmetic/fraction-format';
import { compareRationals, parseInteger } from '@/quality/arithmetic/normalise';
import { integerVerdict } from '@/quality/arithmetic/solvers/addition';
import type {
  CheckResult,
  FractionMissingProblem,
  FractionOperation,
  FractionOperationProblem,
  Rational,
} from '@/quality/arithmetic/types';

/**
 * P3-07: exact rational arithmetic on fractions. Any equivalent form is right — "10/12" for
 * 5/6, "1 1/5" or "6/5" or "1.2" for six fifths — because the checker is asked whether the
 * number is right, and how a child writes it is the teaching's business, not the checker's.
 */
export function solveFractionOperation(
  problem: FractionOperationProblem,
  candidate: string,
): CheckResult {
  const left = readFraction(problem.left);
  const right = readFraction(problem.right);
  if (left === null || right === null) {
    return { verdict: 'undecidable', reason: 'Fraction operations need two fractions.' };
  }
  const truth = operate(problem.operation, left, right);
  const expected = formatFraction(truth);
  const answer = readFraction(candidate);
  return answer !== null && compareRationals(truth, answer) === 0
    ? { verdict: 'correct', expected, reason: 'Exact rational result matches.' }
    : { verdict: 'incorrect', expected, reason: 'Exact rational result differs.' };
}

export function operate(operation: FractionOperation, left: Rational, right: Rational): Rational {
  switch (operation) {
    case 'add':
      return {
        numerator: left.numerator * right.denominator + right.numerator * left.denominator,
        denominator: left.denominator * right.denominator,
      };
    case 'subtract':
      return {
        numerator: left.numerator * right.denominator - right.numerator * left.denominator,
        denominator: left.denominator * right.denominator,
      };
    case 'multiply':
      return {
        numerator: left.numerator * right.numerator,
        denominator: left.denominator * right.denominator,
      };
  }
}

/** "2/3 = ?/12": the numerator that makes the two equal, which must be a whole number. */
export function solveFractionMissing(
  problem: FractionMissingProblem,
  candidate: string,
): CheckResult {
  const left = readFraction(problem.left);
  const denominator = parseInteger(problem.denominator);
  const answer = parseInteger(candidate);
  if (left === null || denominator === null || denominator <= 0n) {
    return {
      verdict: 'undecidable',
      reason: 'A missing numerator needs a fraction and a denominator.',
    };
  }
  if ((left.numerator * denominator) % left.denominator !== 0n) {
    return { verdict: 'undecidable', reason: 'No whole numerator makes these equal.' };
  }
  const expected = (left.numerator * denominator) / left.denominator;
  if (answer === null)
    return { verdict: 'incorrect', expected: expected.toString(), reason: 'Not a whole number.' };
  return integerVerdict(expected, answer, 'missing numerator');
}
