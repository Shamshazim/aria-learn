import { evaluate, linearForm } from '@/quality/arithmetic/expression';
import { formatFraction, readFraction } from '@/quality/arithmetic/fraction-format';
import { compareRationals } from '@/quality/arithmetic/normalise';
import type {
  CheckResult,
  EquationProblem,
  ExpressionProblem,
  ExpressionValueProblem,
  Rational,
} from '@/quality/arithmetic/types';

/** P3-07: expressions, with the standard order of operations, exact. */
export function solveExpression(problem: ExpressionProblem, candidate: string): CheckResult {
  const truth = evaluate(problem.expression);
  return truth === null
    ? { verdict: 'undecidable', reason: 'The expression does not evaluate.' }
    : valueVerdict(truth, candidate);
}

export function solveExpressionValue(
  problem: ExpressionValueProblem,
  candidate: string,
): CheckResult {
  const value = readFraction(problem.value);
  const truth =
    value === null
      ? null
      : evaluate(problem.expression, undefined, { name: problem.variable, value });
  return truth === null
    ? { verdict: 'undecidable', reason: 'The expression does not evaluate at that value.' }
    : valueVerdict(truth, candidate);
}

/**
 * The ticket's rule: an equation is checked by substitution. The child's value goes into both
 * sides and the sides are compared; solving is used only to say what the answer would have been.
 * "x = 8" and "8" are the same answer.
 */
export function solveEquation(problem: EquationProblem, candidate: string): CheckResult {
  const expected = solution(problem);
  if (expected === null) {
    return { verdict: 'undecidable', reason: 'The equation has no single solution.' };
  }
  const text = formatFraction(expected);
  const value = readFraction(
    candidate.replace(new RegExp(`^\\s*${problem.variable}\\s*=\\s*`, 'iu'), ''),
  );
  if (value === null) return { verdict: 'incorrect', expected: text, reason: 'Not a number.' };
  const at = (side: string) => evaluate(side, undefined, { name: problem.variable, value });
  const [left, right] = [at(problem.left), at(problem.right)];
  return left !== null && right !== null && compareRationals(left, right) === 0
    ? { verdict: 'correct', expected: text, reason: 'Substituted, both sides are equal.' }
    : { verdict: 'incorrect', expected: text, reason: 'Substituted, the sides differ.' };
}

/** The one value that balances a linear equation, or `null` when there is not exactly one. */
export function solution(problem: EquationProblem): Rational | null {
  const left = linearForm(problem.left, problem.variable);
  const right = linearForm(problem.right, problem.variable);
  if (left === null || right === null) return null;
  const slope = {
    numerator: left.a.numerator * right.a.denominator - right.a.numerator * left.a.denominator,
    denominator: left.a.denominator * right.a.denominator,
  };
  if (slope.numerator === 0n) return null;
  const constant = {
    numerator: right.b.numerator * left.b.denominator - left.b.numerator * right.b.denominator,
    denominator: right.b.denominator * left.b.denominator,
  };
  const numerator = constant.numerator * slope.denominator;
  const denominator = constant.denominator * slope.numerator;
  return denominator < 0n
    ? { numerator: -numerator, denominator: -denominator }
    : { numerator, denominator };
}

function valueVerdict(truth: Rational, candidate: string): CheckResult {
  const expected = formatFraction(truth);
  const answer = readFraction(candidate);
  return answer !== null && compareRationals(truth, answer) === 0
    ? { verdict: 'correct', expected, reason: 'Exact value matches.' }
    : { verdict: 'incorrect', expected, reason: 'Exact value differs.' };
}
