import type { ArithmeticRule } from '@/curriculum/misconceptions/signature.types';
import { formatFraction, gcd, readWrittenFraction } from '@/quality/arithmetic/fraction-format';
import { compareRationals, parseInteger } from '@/quality/arithmetic/normalise';
import { operate } from '@/quality/arithmetic/solvers/fraction-operations';
import type {
  FractionMissingProblem,
  FractionOperationProblem,
  Rational,
} from '@/quality/arithmetic/types';

/**
 * What the fraction wrong ideas predict (P3-07). Same contract as `derived-arithmetic.ts`, with
 * one addition: a prediction is offered as the child would write it ("4/8") and in lowest
 * terms ("1/2"), because a child holding the idea writes the first and a distractor reads
 * better as the second. Anything equal to the right answer, in any form, is dropped.
 */
export function fractionMissingError(
  rule: ArithmeticRule,
  problem: FractionMissingProblem,
): readonly string[] {
  const left = readWrittenFraction(problem.left);
  const denominator = parseInteger(problem.denominator);
  if (left === null || denominator === null || left.denominator <= 0n) return [];
  const truth = (left.numerator * denominator) / left.denominator;
  const predicted = ((): bigint[] => {
    switch (rule) {
      // 2/3 = ?/12 answered 11: the 9 added to the bottom added to the top as well.
      case 'additive-equivalence':
        return [left.numerator + (denominator - left.denominator)];
      case 'kept-numerator':
        return [left.numerator];
      // 2/3 = ?/12 answered 4: found what the bottom was multiplied by, and stopped.
      case 'answered-the-factor':
        return denominator % left.denominator === 0n ? [denominator / left.denominator] : [];
      default:
        return [];
    }
  })();
  return [...new Set(predicted.filter((value) => value !== truth).map(String))];
}

export function fractionOperationError(
  rule: ArithmeticRule,
  problem: FractionOperationProblem,
): readonly string[] {
  const left = readWrittenFraction(problem.left);
  const right = readWrittenFraction(problem.right);
  if (left === null || right === null || left.denominator <= 0n || right.denominator <= 0n) {
    return [];
  }
  const truth = operate(problem.operation, left, right);
  // A rule that only does a different operation has no "as written" form worth offering.
  const reducedOnly = rule === 'flipped-operation' || rule === 'added-whole';
  return candidates(rule, problem, left, right).flatMap((value) =>
    value.denominator <= 0n || value.numerator < 0n || compareRationals(value, truth) === 0
      ? []
      : unique(reducedOnly ? [formatFraction(value)] : [written(value), formatFraction(value)]),
  );
}

function candidates(
  rule: ArithmeticRule,
  problem: FractionOperationProblem,
  left: Rational,
  right: Rational,
): Rational[] {
  return problem.operation === 'multiply'
    ? multiplyCandidates(rule, left, right)
    : sumCandidates(rule, problem.operation, left, right);
}

function sumCandidates(
  rule: ArithmeticRule,
  operation: 'add' | 'subtract',
  left: Rational,
  right: Rational,
): Rational[] {
  const top =
    operation === 'add' ? left.numerator + right.numerator : left.numerator - right.numerator;
  switch (rule) {
    // 1/2 + 1/3 = 2/5: tops added and bottoms added, as if they were two whole numbers each.
    case 'combined-denominators':
      return [{ numerator: top, denominator: left.denominator + right.denominator }];
    // 3/8 + 2/8 = 5: the pieces counted and the size of the piece forgotten.
    case 'numerator-only':
      return [{ numerator: top, denominator: 1n }];
    case 'flipped-operation':
      return [operate(operation === 'add' ? 'subtract' : 'add', left, right)];
    // 1/2 + 1/3 = 2/3: tops added and the bigger bottom kept, without renaming either.
    case 'kept-one-denominator':
      return [{ numerator: top, denominator: max(left.denominator, right.denominator) }];
    // 1/2 + 1/3 = 2/6: the bottoms renamed to sixths but the tops left as they were.
    case 'renamed-denominators-only':
      return [{ numerator: top, denominator: lcm(left.denominator, right.denominator) }];
    default:
      return [];
  }
}

/** A whole number (`whole`, over one) times a fraction. */
function multiplyCandidates(rule: ArithmeticRule, whole: Rational, fraction: Rational): Rational[] {
  switch (rule) {
    // 3 × 2/5 = 6/15: the whole multiplied into the top and the bottom.
    case 'multiplied-both':
      return [
        {
          numerator: whole.numerator * fraction.numerator,
          denominator: whole.numerator * fraction.denominator,
        },
      ];
    // 3 × 2/5 = 3 2/5: the whole put next to the fraction.
    case 'added-whole':
      return [operate('add', whole, fraction)];
    // 3 × 2/5 = 2/15: the whole multiplied into the bottom, so the pieces got smaller.
    case 'multiplied-denominator':
      return [
        { numerator: fraction.numerator, denominator: whole.numerator * fraction.denominator },
      ];
    default:
      return [];
  }
}

/** As the arithmetic produced it, not reduced: what a child holding the idea writes down. */
function written(value: Rational): string {
  return value.denominator === 1n
    ? value.numerator.toString()
    : `${value.numerator.toString()}/${value.denominator.toString()}`;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function max(left: bigint, right: bigint): bigint {
  return left > right ? left : right;
}

function lcm(left: bigint, right: bigint): bigint {
  return (left * right) / gcd(left, right);
}
