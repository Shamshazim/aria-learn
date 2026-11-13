import type { ArithmeticRule } from '@/curriculum/misconceptions/signature.types';
import { parseInteger } from '@/quality/arithmetic/normalise';
import { roundToTen } from '@/quality/arithmetic/solvers/rounding';
import type {
  DigitPlaceProblem,
  RoundingProblem,
  WholeComparisonProblem,
} from '@/quality/arithmetic/types';

const PLACE: Readonly<Record<DigitPlaceProblem['place'], bigint>> = {
  ones: 1n,
  tens: 10n,
  hundreds: 100n,
  thousands: 1_000n,
};

/**
 * What the number-sense wrong ideas predict (P3-07), in the same shape as the rest of
 * `derived-arithmetic.ts`: the answers a child holding the idea would give, never a boolean,
 * so the distractor that offers the idea and the matcher that recognises it are one function.
 * A prediction that happens to be right is not a wrong answer and is not returned.
 */
export function placeValueError(
  rule: ArithmeticRule,
  problem: DigitPlaceProblem,
): readonly string[] {
  const number = parseInteger(problem.number);
  if (number === null || number < 0n) return [];
  const place = PLACE[problem.place];
  const digit = (number / place) % 10n;
  // The neighbouring place a child reads instead: the one to the right, or the tens for ones.
  const neighbour = place === 1n ? 10n : place / 10n;
  switch (rule) {
    case 'other-place-digit':
      return differs(((number / neighbour) % 10n).toString(), digit);
    case 'place-amount':
      return place === 1n ? [] : differs((digit * place).toString(), digit);
    case 'whole-number':
      return differs(number.toString(), digit);
    default:
      return [];
  }
}

export function wholeComparisonError(
  rule: ArithmeticRule,
  problem: WholeComparisonProblem,
): readonly string[] {
  const left = parseInteger(problem.left);
  const right = parseInteger(problem.right);
  if (left === null || right === null) return [];
  const truth = relation(left, right);
  switch (rule) {
    case 'reversed-comparison':
      return truth === '=' ? [] : [truth === '<' ? '>' : '<'];
    case 'ones-digit-comparison':
      return unless(relation(left % 10n, right % 10n), truth);
    case 'same-tens-equal':
      return left / 10n === right / 10n ? unless('=', truth) : [];
    default:
      return [];
  }
}

export function roundingError(rule: ArithmeticRule, problem: RoundingProblem): readonly string[] {
  const number = parseInteger(problem.number);
  if (number === null || number < 0n) return [];
  const truth = roundToTen(number);
  const ones = number % 10n;
  switch (rule) {
    case 'rounded-down':
      return differs((number - ones).toString(), truth);
    case 'rounded-up':
      return ones === 0n ? [] : differs((number - ones + 10n).toString(), truth);
    case 'rounded-to-hundred': {
      const tens = number % 100n;
      return differs((tens >= 50n ? number - tens + 100n : number - tens).toString(), truth);
    }
    default:
      return [];
  }
}

function relation(left: bigint, right: bigint): '<' | '=' | '>' {
  return left < right ? '<' : left > right ? '>' : '=';
}

function unless(claimed: '<' | '=' | '>', truth: '<' | '=' | '>'): readonly string[] {
  return claimed === truth ? [] : [claimed];
}

function differs(predicted: string, truth: bigint): readonly string[] {
  return predicted === truth.toString() ? [] : [predicted];
}
