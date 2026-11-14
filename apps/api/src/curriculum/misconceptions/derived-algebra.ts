import type { ArithmeticRule } from '@/curriculum/misconceptions/signature.types';
import { evaluate, linearForm, type Rules } from '@/quality/arithmetic/expression';
import { formatFraction, readFraction } from '@/quality/arithmetic/fraction-format';
import { compareRationals } from '@/quality/arithmetic/normalise';
import { solution } from '@/quality/arithmetic/solvers/expressions';
import type {
  EquationProblem,
  ExpressionProblem,
  ExpressionValueProblem,
  Rational,
} from '@/quality/arithmetic/types';

type AlgebraProblem = ExpressionProblem | ExpressionValueProblem | EquationProblem;

/** The wrong orders of operations, as rules the evaluator can run. */
const WRONG_RULES: Readonly<Partial<Record<ArithmeticRule, Rules>>> = {
  // 3 + 4 × 2 = 14: straight through, left to right.
  'left-to-right': { levels: [['+', '-', '×', '÷']], brackets: true },
  // (3 + 4) × 2 = 11: the brackets not seen.
  'ignored-brackets': {
    levels: [
      ['+', '-'],
      ['×', '÷'],
    ],
    brackets: false,
  },
  // 2 × 3 + 4 = 14: adding before multiplying, everywhere.
  'addition-first': {
    levels: [
      ['×', '÷'],
      ['+', '-'],
    ],
    brackets: true,
  },
};

/**
 * What the expression and equation wrong ideas predict (P3-07). Same contract as the rest of
 * `derived-arithmetic.ts`: answers a child holding the idea would give, never a right one.
 */
export function algebraError(rule: ArithmeticRule, problem: AlgebraProblem): readonly string[] {
  switch (problem.kind) {
    case 'expression': {
      const rules = WRONG_RULES[rule];
      return wrongOnly(
        [rules === undefined ? null : evaluate(problem.expression, rules)],
        evaluate(problem.expression),
      );
    }
    case 'expression-value':
      return valueError(rule, problem);
    case 'equation':
      return equationError(rule, problem);
  }
}

function valueError(rule: ArithmeticRule, problem: ExpressionValueProblem): readonly string[] {
  const value = readFraction(problem.value);
  if (value === null) return [];
  const truth = evaluate(problem.expression, undefined, { name: problem.variable, value });
  const coefficient = new RegExp(`(\\d+)${problem.variable}`, 'gu');
  if (!coefficient.test(problem.expression)) return [];
  const rewrite = ((): ((digits: string) => string) | null => {
    switch (rule) {
      // 3n when n = 5 read as 35.
      case 'concatenated-coefficient':
        return (digits) => `${digits}${problem.value}`;
      // 3n when n = 5 read as 3 + 5.
      case 'added-coefficient':
        return (digits) => `(${digits} + ${problem.value})`;
      // 3n when n = 5 read as 5.
      case 'ignored-coefficient':
        return () => problem.value;
      default:
        return null;
    }
  })();
  if (rewrite === null) return [];
  const rewritten = problem.expression.replace(coefficient, (_match, digits: string) =>
    rewrite(digits),
  );
  return wrongOnly([evaluate(rewritten, undefined, { name: problem.variable, value })], truth);
}

function equationError(rule: ArithmeticRule, problem: EquationProblem): readonly string[] {
  const left = linearForm(problem.left, problem.variable);
  const right = evaluate(problem.right);
  if (left === null || right === null) return [];
  const { a, b } = left;
  const predicted = ((): (Rational | null)[] => {
    switch (rule) {
      // x + 7 = 15 → 22, 3x = 12 → 36: each step undone with the wrong operation.
      case 'wrong-inverse':
        return [times(plus(right, b), a)];
      case 'kept-right-side':
        return [right];
      // x + 7 = 15 → 7: the number beside the letter given as the answer.
      case 'answered-the-operand':
        return [
          b.numerator !== 0n
            ? absolute(b)
            : a.denominator === 1n
              ? a
              : { numerator: a.denominator, denominator: 1n },
        ];
      // 3x + 4 = 19 → 15: one step undone, and the times 3 left standing.
      case 'stopped-after-one-step':
        return b.numerator === 0n || isOne(a) ? [] : [plus(right, negate(b))];
      // 3x + 4 = 19 → 19 ÷ 3 − 4: the steps undone in the wrong order.
      case 'divided-first':
        return b.numerator === 0n || isOne(a) ? [] : [plusOrNull(divide(right, a), negate(b))];
      default:
        return [];
    }
  })();
  return wrongOnly(predicted, solution(problem));
}

function wrongOnly(
  predicted: readonly (Rational | null)[],
  truth: Rational | null,
): readonly string[] {
  if (truth === null) return [];
  return [
    ...new Set(
      predicted.flatMap((value) =>
        value === null || compareRationals(value, truth) === 0 ? [] : [formatFraction(value)],
      ),
    ),
  ];
}

function plus(left: Rational, right: Rational): Rational {
  return {
    numerator: left.numerator * right.denominator + right.numerator * left.denominator,
    denominator: left.denominator * right.denominator,
  };
}

function plusOrNull(left: Rational | null, right: Rational): Rational | null {
  return left === null ? null : plus(left, right);
}

function times(left: Rational, right: Rational): Rational {
  return {
    numerator: left.numerator * right.numerator,
    denominator: left.denominator * right.denominator,
  };
}

function divide(left: Rational, right: Rational): Rational | null {
  if (right.numerator === 0n) return null;
  const value = {
    numerator: left.numerator * right.denominator,
    denominator: left.denominator * right.numerator,
  };
  return value.denominator < 0n
    ? { numerator: -value.numerator, denominator: -value.denominator }
    : value;
}

function negate(value: Rational): Rational {
  return { numerator: -value.numerator, denominator: value.denominator };
}

function absolute(value: Rational): Rational {
  return value.numerator < 0n ? negate(value) : value;
}

function isOne(value: Rational): boolean {
  return value.numerator === value.denominator;
}
