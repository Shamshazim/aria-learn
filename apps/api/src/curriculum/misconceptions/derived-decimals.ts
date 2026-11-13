import type { ArithmeticRule } from '@/curriculum/misconceptions/signature.types';
import { decimalPlaces, formatDecimal } from '@/quality/arithmetic/decimal-format';
import { compareRationals, parseRational } from '@/quality/arithmetic/normalise';
import type {
  DecimalComparisonProblem,
  DecimalOperationProblem,
  DecimalPlaceProblem,
  PercentOfProblem,
  Rational,
} from '@/quality/arithmetic/types';

/**
 * What the decimal and percent wrong ideas predict (P3-07). Same contract as the rest of
 * `derived-arithmetic.ts`: answers a child holding the idea would give, and never a right one.
 */
export function decimalPlaceError(
  rule: ArithmeticRule,
  problem: DecimalPlaceProblem,
): readonly string[] {
  const match = /^\s*(\d+)\.(\d)(\d)?\s*$/u.exec(problem.number);
  if (match === null) return [];
  const [ones, tenths, hundredths] = [match[1]?.at(-1), match[2], match[3]];
  const asked = problem.place === 'tenths' ? tenths : hundredths;
  const other = problem.place === 'tenths' ? hundredths : tenths;
  if (asked === undefined) return [];
  const predicted = ((): (string | undefined)[] => {
    switch (rule) {
      // 3.47, tenths, answered 7: read the places in the wrong order.
      case 'decimal-neighbour-digit':
        return [other];
      // 3.47, tenths, answered 0.4: the digit's value, not the digit.
      case 'decimal-place-amount':
        return [problem.place === 'tenths' ? `0.${asked}` : `0.0${asked}`];
      // 3.47, tenths, answered 3: counted the ones as the first place.
      case 'decimal-ones-digit':
        return problem.place === 'tenths' ? [ones] : [];
      default:
        return [];
    }
  })();
  return [
    ...new Set(
      predicted.filter((value): value is string => value !== undefined && value !== asked),
    ),
  ];
}

export function decimalComparisonError(
  rule: ArithmeticRule,
  problem: DecimalComparisonProblem,
): readonly string[] {
  const left = parseRational(problem.left, true);
  const right = parseRational(problem.right, true);
  if (left === null || right === null) return [];
  const truth = compareRationals(left, right);
  const longer = signOf(decimalPlaces(problem.left) - decimalPlaces(problem.right));
  const claim = ((): -1 | 0 | 1 | null => {
    switch (rule) {
      // 0.25 > 0.3: more digits means a bigger number.
      case 'longer-is-larger':
        return longer === 0 ? null : longer;
      // 0.3 > 0.45 because tenths are bigger than hundredths, whatever the digits.
      case 'shorter-is-larger':
        return longer === 0 ? null : flip(longer);
      case 'reversed-comparison':
        return truth === 0 ? null : flip(truth);
      default:
        return null;
    }
  })();
  if (claim === null || claim === truth) return [];
  return [claim < 0 ? '<' : claim > 0 ? '>' : '='];
}

export function decimalOperationError(
  rule: ArithmeticRule,
  problem: DecimalOperationProblem,
): readonly string[] {
  const left = parseRational(problem.left, true);
  const right = parseRational(problem.right, true);
  if (left === null || right === null) return [];
  const sign = problem.operation === 'add' ? 1n : -1n;
  const truth = combine(left, right, sign);
  const places = Math.max(decimalPlaces(problem.left), decimalPlaces(problem.right));
  const predicted = ((): (Rational | null)[] => {
    switch (rule) {
      // 3.4 + 1.25 = 1.59: the digits lined up on the right, as whole numbers are.
      case 'right-aligned-digits':
        return [scaled(digitsOf(problem.left) + sign * digitsOf(problem.right), places)];
      // 3.4 + 1.25 = 465: the right digits with the point left out.
      case 'dropped-decimal-point':
        return truth.denominator === 1n ? [] : [scaled(digitsOf(formatDecimal(truth) ?? ''), 0)];
      // 3.4 + 1.25 = 4.29: the wholes added, and the parts after the point added as wholes.
      case 'decimal-parts-as-wholes':
        return [partsAsWholes(problem, sign)];
      default:
        return [];
    }
  })();
  return written(predicted, truth);
}

export function percentOfError(rule: ArithmeticRule, problem: PercentOfProblem): readonly string[] {
  const percent = parseRational(problem.percent, true);
  const whole = parseRational(problem.whole, true);
  if (percent === null || whole === null || percent.numerator === 0n) return [];
  const truth = {
    numerator: percent.numerator * whole.numerator,
    denominator: percent.denominator * whole.denominator * 100n,
  };
  const predicted = ((): Rational[] => {
    switch (rule) {
      // 25% of 80 = 2000: multiplied by 25 and never divided by a hundred.
      case 'percent-without-hundred':
        return [
          {
            numerator: percent.numerator * whole.numerator,
            denominator: percent.denominator * whole.denominator,
          },
        ];
      // 25% of 80 = 3.2: "of" read as "divided by".
      case 'divided-by-percent':
        return [
          {
            numerator: whole.numerator * percent.denominator,
            denominator: whole.denominator * percent.numerator,
          },
        ];
      // 25% of 80 = 55: the percent taken away from the whole.
      case 'subtracted-percent':
        return [combine(whole, percent, -1n)];
      default:
        return [];
    }
  })();
  return written(predicted, truth);
}

function signOf(value: number): -1 | 0 | 1 {
  return value < 0 ? -1 : value > 0 ? 1 : 0;
}

function flip(value: -1 | 1): -1 | 1 {
  return value === 1 ? -1 : 1;
}

function combine(left: Rational, right: Rational, sign: bigint): Rational {
  return {
    numerator: left.numerator * right.denominator + sign * right.numerator * left.denominator,
    denominator: left.denominator * right.denominator,
  };
}

/** "3.4" as 34, "1.25" as 125: every digit, the point ignored. */
function digitsOf(text: string): bigint {
  const digits = text.replace(/[^\d]/gu, '');
  return digits === '' ? 0n : BigInt(digits);
}

function scaled(value: bigint, places: number): Rational | null {
  return value < 0n ? null : { numerator: value, denominator: 10n ** BigInt(places) };
}

function partsAsWholes(problem: DecimalOperationProblem, sign: bigint): Rational | null {
  const [leftWhole = '0', leftPart = ''] = problem.left.trim().split('.');
  const [rightWhole = '0', rightPart = ''] = problem.right.trim().split('.');
  if (leftPart === '' || rightPart === '') return null;
  const wholes = BigInt(leftWhole) + sign * BigInt(rightWhole);
  const parts = BigInt(leftPart) + sign * BigInt(rightPart);
  if (wholes < 0n || parts < 0n) return null;
  const text = `${wholes.toString()}.${parts.toString()}`;
  return parseRational(text, true);
}

function written(predicted: readonly (Rational | null)[], truth: Rational): readonly string[] {
  return [
    ...new Set(
      predicted.flatMap((value) =>
        value === null || value.numerator < 0n || compareRationals(value, truth) === 0
          ? []
          : [
              formatDecimal(value) ??
                `${value.numerator.toString()}/${value.denominator.toString()}`,
            ],
      ),
    ),
  ];
}
