import type { ArithmeticRule } from '@/curriculum/misconceptions/signature.types';
import { parseInteger } from '@/quality/arithmetic/normalise';
import { integerResult } from '@/quality/arithmetic/solvers/integers';
import type {
  AbsoluteValueProblem,
  IntegerComparisonProblem,
  IntegerOperationProblem,
} from '@/quality/arithmetic/types';

type IntegerProblem = IntegerComparisonProblem | AbsoluteValueProblem | IntegerOperationProblem;

/**
 * What the integer wrong ideas predict (P3-07). Same contract as the rest of
 * `derived-arithmetic.ts`: answers a child holding the idea would give, never a right one.
 */
export function integerError(rule: ArithmeticRule, problem: IntegerProblem): readonly string[] {
  switch (problem.kind) {
    case 'integer-comparison':
      return comparisonError(rule, problem);
    case 'absolute-value':
      return absoluteError(rule, problem);
    case 'integer-operation':
      return operationError(rule, problem);
  }
}

function comparisonError(
  rule: ArithmeticRule,
  problem: IntegerComparisonProblem,
): readonly string[] {
  const left = parseInteger(problem.left);
  const right = parseInteger(problem.right);
  if (left === null || right === null) return [];
  const truth = compare(left, right);
  const claim = ((): -1 | 0 | 1 | null => {
    switch (rule) {
      // -7 > -3, because 7 is more than 3: the size compared and the sign ignored.
      case 'absolute-value-comparison':
        return compare(abs(left), abs(right));
      case 'reversed-comparison':
        return truth === 0 ? null : truth === 1 ? -1 : 1;
      // 0 < -3: nothing is smaller than nothing.
      case 'zero-is-smallest':
        return left === 0n && right < 0n ? -1 : right === 0n && left < 0n ? 1 : null;
      default:
        return null;
    }
  })();
  return claim === null || claim === truth ? [] : [claim < 0 ? '<' : claim > 0 ? '>' : '='];
}

function absoluteError(rule: ArithmeticRule, problem: AbsoluteValueProblem): readonly string[] {
  const number = parseInteger(problem.number);
  if (number === null) return [];
  const truth = abs(number);
  const predicted = ((): bigint[] => {
    switch (rule) {
      // |-7| = -7: the sign kept.
      case 'kept-sign':
        return number < 0n ? [number] : [];
      // |7| = -7: absolute value taken to mean "the opposite".
      case 'negated':
        return number > 0n ? [-number] : [];
      // |-7| = 8: the zero counted as a step on the number line.
      case 'counted-zero':
        return number === 0n ? [] : [truth + 1n];
      default:
        return [];
    }
  })();
  return unique(predicted.filter((value) => value !== truth));
}

function operationError(rule: ArithmeticRule, problem: IntegerOperationProblem): readonly string[] {
  const left = parseInteger(problem.left);
  const right = parseInteger(problem.right);
  if (left === null || right === null) return [];
  const truth = integerResult(problem.operation, left, right);
  if (truth === null) return [];
  const predicted =
    rule === 'wrong-sign'
      ? [truth === 0n ? null : -truth]
      : problem.operation === 'add' || problem.operation === 'subtract'
        ? sumRule(rule, problem.operation, left, right)
        : productRule(rule, problem.operation, [left, right], truth);
  return unique(predicted.filter((value): value is bigint => value !== null && value !== truth));
}

// -5 + 3 = 2 is the wrong-sign rule above: the right size, the wrong sign.
function sumRule(
  rule: ArithmeticRule,
  operation: 'add' | 'subtract',
  left: bigint,
  right: bigint,
): (bigint | null)[] {
  switch (rule) {
    // 5 - (-3) = 2: taking away a negative read as taking away.
    case 'minus-negative-as-minus':
      return operation === 'subtract' && right < 0n ? [left + right] : [];
    // -5 + 3 = -8: the sizes added and the first sign kept, though the signs differ.
    case 'magnitudes-added':
      return operation === 'add' && sign(left) !== sign(right)
        ? [BigInt(sign(left)) * (abs(left) + abs(right))]
        : [];
    default:
      return [];
  }
}

function productRule(
  rule: ArithmeticRule,
  operation: 'multiply' | 'divide',
  [left, right]: readonly [bigint, bigint],
  truth: bigint,
): (bigint | null)[] {
  switch (rule) {
    // -6 × -4 = -24: the answer takes the sign of the first number.
    case 'sign-of-first-factor':
      return [BigInt(sign(left) || 1) * abs(truth)];
    case 'added-instead':
      return operation === 'multiply' ? [left + right] : [];
    default:
      return [];
  }
}

function compare(left: bigint, right: bigint): -1 | 0 | 1 {
  return left < right ? -1 : left > right ? 1 : 0;
}

function abs(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function sign(value: bigint): -1 | 0 | 1 {
  return value < 0n ? -1 : value > 0n ? 1 : 0;
}

function unique(values: readonly bigint[]): string[] {
  return [...new Set(values.map(String))];
}
