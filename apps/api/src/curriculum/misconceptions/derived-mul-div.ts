import type { ArithmeticRule } from '@/curriculum/misconceptions/signature.types';
import { parseInteger } from '@/quality/arithmetic/normalise';
import { formatQuotientWithRemainder } from '@/quality/arithmetic/remainder';
import type { DivisionProblem, MultiplicationProblem } from '@/quality/arithmetic/types';

/**
 * What the multiplication-and-division wrong ideas predict (P3-07). Same contract as the rest of
 * `derived-arithmetic.ts`: the answers a child holding the idea would give, never a boolean,
 * and never one that happens to be right.
 */
export function multiplicationError(
  rule: ArithmeticRule,
  problem: MultiplicationProblem,
): readonly string[] {
  const left = parseInteger(problem.left);
  const right = parseInteger(problem.right);
  if (left === null || right === null || left < 0n || right < 0n) return [];
  return wrongOnly(multiplicationPrediction(rule, left, right), (left * right).toString());
}

export function divisionError(rule: ArithmeticRule, problem: DivisionProblem): readonly string[] {
  const dividend = parseInteger(problem.left);
  const divisor = parseInteger(problem.right);
  if (dividend === null || divisor === null || divisor <= 0n || dividend < 0n) return [];
  const answer = { quotient: dividend / divisor, remainder: dividend % divisor };
  return wrongOnly(
    divisionPrediction(rule, { dividend, divisor, ...answer }),
    formatQuotientWithRemainder(answer),
  );
}

function multiplicationPrediction(rule: ArithmeticRule, left: bigint, right: bigint): string[] {
  const ones = (left % 10n) * right;
  const tens = (left / 10n) * right;
  switch (rule) {
    case 'added-instead':
      return [(left + right).toString()];
    // Skip-counted one jump too few, or one too many, on either factor.
    case 'one-group-short':
      return [((left - 1n) * right).toString(), (left * (right - 1n)).toString()];
    case 'one-group-extra':
      return [((left + 1n) * right).toString(), (left * (right + 1n)).toString()];
    // 47 × 6 written as 24|42: each digit's product set down whole, side by side.
    case 'column-products-concatenated':
      return left < 10n ? [] : [`${tens.toString()}${ones.toString()}`];
    // 47 × 6 = 242: the 4 tens from 42 never added to the tens.
    case 'dropped-product-carry':
      return left < 10n || ones < 10n ? [] : [(tens * 10n + (ones % 10n)).toString()];
    // 47 × 6 = 66: the tens digit multiplied as if it were ones.
    case 'tens-digit-as-ones':
      return left < 10n ? [] : [(tens + ones).toString()];
    default:
      return [];
  }
}

type Division = Readonly<{
  dividend: bigint;
  divisor: bigint;
  quotient: bigint;
  remainder: bigint;
}>;

function divisionPrediction(rule: ArithmeticRule, division: Division): string[] {
  const { dividend, divisor, quotient, remainder } = division;
  switch (rule) {
    case 'multiplied-instead':
      return [(dividend * divisor).toString()];
    case 'subtracted-instead':
      return [(dividend - divisor).toString()];
    case 'one-group-short':
      return quotient > 0n
        ? [formatQuotientWithRemainder({ quotient: quotient - 1n, remainder })]
        : [];
    // 157 ÷ 4 = 39: the 1 left over is forgotten.
    case 'remainder-dropped':
      return remainder > 0n ? [quotient.toString()] : [];
    // 157 ÷ 4 = 39.1: the remainder written after a decimal point.
    case 'remainder-as-decimal':
      return remainder > 0n ? [`${quotient.toString()}.${remainder.toString()}`] : [];
    // 412 ÷ 4 = 13: "4 into 1 won't go", so no zero is written in the quotient.
    case 'missing-zero-in-quotient':
      return missingZero(quotient, remainder);
    default:
      return [];
  }
}

function missingZero(quotient: bigint, remainder: bigint): string[] {
  const digits = quotient.toString();
  const inner = digits.slice(1).replaceAll('0', '');
  if (inner.length === digits.length - 1) return [];
  const shortened = BigInt(`${digits[0] ?? ''}${inner}`);
  return [formatQuotientWithRemainder({ quotient: shortened, remainder })];
}

function wrongOnly(predictions: readonly string[], truth: string): readonly string[] {
  return [...new Set(predictions)].filter((value) => value !== truth);
}
