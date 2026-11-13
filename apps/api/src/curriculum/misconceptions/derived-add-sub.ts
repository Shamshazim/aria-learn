import type { ArithmeticRule } from '@/curriculum/misconceptions/signature.types';
import { parseInteger } from '@/quality/arithmetic/normalise';
import type { AdditionProblem, SubtractionProblem } from '@/quality/arithmetic/types';

/**
 * What the addition-and-subtraction wrong ideas predict (P3-07), column by column so the same
 * rule holds for two digits and three. Same contract as `derived-arithmetic.ts`: the answers a
 * child holding the idea would give, and never one that happens to be right.
 */
export function additionColumnError(
  rule: ArithmeticRule,
  problem: AdditionProblem,
): readonly string[] {
  const left = parseInteger(problem.left);
  const right = parseInteger(problem.right);
  if (left === null || right === null || left < 0n || right < 0n) return [];
  return wrongOnly(additionPrediction(rule, left, right), left + right);
}

export function subtractionError(
  rule: ArithmeticRule,
  problem: SubtractionProblem,
): readonly string[] {
  const left = parseInteger(problem.left);
  const right = parseInteger(problem.right);
  if (left === null || right === null || right < 0n || left < right) return [];
  return wrongOnly(subtractionPrediction(rule, left, right), left - right);
}

function additionPrediction(
  rule: ArithmeticRule,
  left: bigint,
  right: bigint,
): bigint[] | string[] {
  const columns = zipColumns(left, right).map(([top, bottom]) => top + bottom);
  switch (rule) {
    // 158 + 267 written as 3|11|15: every column added and written down whole.
    case 'column-sums-concatenated':
      return columns.some((sum) => sum >= 10n) ? [[...columns].reverse().join('')] : [];
    // 158 + 267 = 315: each column's ones digit kept, every carry lost.
    case 'dropped-every-carry':
      return [fromDigits(columns.map((sum) => sum % 10n))];
    // 158 + 267 = 325: the ones carry made it, the carry into the hundreds did not.
    case 'dropped-hundreds-carry':
      return droppedHundredsCarry(left, right);
    // 8 + 5 = 10: made the ten, then forgot the three left over.
    case 'stopped-at-ten':
      return left + right > 10n ? [10n] : [];
    default:
      return [];
  }
}

function subtractionPrediction(rule: ArithmeticRule, left: bigint, right: bigint): bigint[] {
  const columns = zipColumns(left, right);
  switch (rule) {
    case 'added-instead':
      return [left + right];
    // 7 - 3 counted back as "7, 6, 5": the start counted as the first step.
    case 'counted-back-including-start':
      return [left - right + 1n];
    case 'answered-the-part':
      return [right];
    // 52 - 18 = 46: in every column, the smaller digit taken from the bigger.
    case 'smaller-from-larger':
      return [
        fromDigits(columns.map(([top, bottom]) => (top >= bottom ? top - bottom : bottom - top))),
      ];
    // 52 - 18 = 44: the ten was borrowed into the ones but never taken from the tens.
    case 'borrowed-without-reducing-tens':
      return [
        fromDigits(
          columns.map(([top, bottom]) => (top >= bottom ? top - bottom : top + 10n - bottom)),
        ),
      ];
    // 52 - 18 = 40: "you can't take 8 from 2", so the column is written as zero.
    case 'zero-when-smaller':
      return [fromDigits(columns.map(([top, bottom]) => (top >= bottom ? top - bottom : 0n)))];
    default:
      return [];
  }
}

function droppedHundredsCarry(left: bigint, right: bigint): bigint[] {
  const [ones = 0n, tens = 0n] = zipColumns(left, right).map(([top, bottom]) => top + bottom);
  const tensWithCarry = tens + ones / 10n;
  return tensWithCarry >= 10n ? [left + right - 100n] : [];
}

/** Ones first: `[[ones, ones], [tens, tens], ...]`, the shorter number padded with zeros. */
function zipColumns(left: bigint, right: bigint): [bigint, bigint][] {
  const columns: [bigint, bigint][] = [];
  for (let top = left, bottom = right; top > 0n || bottom > 0n; top /= 10n, bottom /= 10n) {
    columns.push([top % 10n, bottom % 10n]);
  }
  return columns;
}

/** Ones first, back to a number: each column's digit in its own place. */
function fromDigits(digits: readonly bigint[]): bigint {
  return digits.reduceRight((total, digit) => total * 10n + digit, 0n);
}

function wrongOnly(predictions: readonly (bigint | string)[], truth: bigint): readonly string[] {
  return [...new Set(predictions.map(String))].filter((value) => value !== truth.toString());
}
