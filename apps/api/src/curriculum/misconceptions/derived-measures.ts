import type { ArithmeticRule } from '@/curriculum/misconceptions/signature.types';
import { formatDecimal } from '@/quality/arithmetic/decimal-format';
import { formatFraction } from '@/quality/arithmetic/fraction-format';
import type { MeasureProblem } from '@/quality/arithmetic/kinds';
import { compareRationals, parseInteger, parseRational } from '@/quality/arithmetic/normalise';
import {
  average,
  cents,
  clockMinutes,
  dollars,
  middle,
  statistic,
} from '@/quality/arithmetic/solvers/measures';
import type { Rational } from '@/quality/arithmetic/types';
import { conversionFactor } from '@/quality/arithmetic/units';

/**
 * What the measurement and data wrong ideas predict (P3-07). Same contract as the rest of
 * `derived-arithmetic.ts`: answers a child holding the idea would give, never a right one.
 */
export function measureError(rule: ArithmeticRule, problem: MeasureProblem): readonly string[] {
  switch (problem.kind) {
    case 'elapsed-time':
      return timeError(rule, problem.start, problem.minutes);
    case 'money-change':
      return moneyError(rule, problem.paid, problem.cost);
    case 'rectangle':
      return rectangleError(rule, problem);
    case 'unit-conversion':
      return conversionError(rule, problem);
    case 'statistic':
      return statisticError(rule, problem);
  }
}

function timeError(rule: ArithmeticRule, start: string, added: string): readonly string[] {
  const begin = clockMinutes(start);
  const minutes = parseInteger(added);
  if (begin === null || minutes === null) return [];
  const [hour, minute] = [Math.floor(begin / 60) || 12, begin % 60];
  const total = minute + Number(minutes);
  if (total < 60) return [];
  switch (rule) {
    // 2:45 + 30 minutes = 2:75: the minutes counted to a hundred, as with ordinary numbers.
    case 'minutes-as-hundreds':
      return total < 100 ? [`${String(hour)}:${String(total)}`] : [];
    // 2:45 + 30 minutes = 2:15: the minutes went round, the hour stayed.
    case 'hour-not-carried':
      return [`${String(hour)}:${String(total % 60).padStart(2, '0')}`];
    // 2:45 + 30 minutes = 2:30: the minutes added put where the minutes were.
    case 'minutes-replaced':
      return [`${String(hour)}:${String(Number(minutes)).padStart(2, '0')}`];
    default:
      return [];
  }
}

function moneyError(rule: ArithmeticRule, paidText: string, costText: string): readonly string[] {
  const [paid, cost] = [cents(paidText), cents(costText)];
  if (paid === null || cost === null || cost > paid) return [];
  const truth = paid - cost;
  const predicted = ((): bigint[] => {
    switch (rule) {
      // $5.00 − $3.45 = $2.45: in each column the smaller digit taken from the bigger.
      case 'smaller-from-larger':
        return [columnwise(paid, cost)];
      case 'added-instead':
        return [paid + cost];
      default:
        return [];
    }
  })();
  const formatted = predicted.filter((value) => value !== truth).map(dollars);
  // $1.55 written as 155: the right digits, the point left out (and so read as dollars).
  if (rule === 'dropped-decimal-point' && truth % 100n !== 0n) return [truth.toString()];
  return formatted;
}

function columnwise(top: bigint, bottom: bigint): bigint {
  let result = 0n;
  for (let place = 1n, a = top, b = bottom; a > 0n || b > 0n; place *= 10n, a /= 10n, b /= 10n) {
    const [x, y] = [a % 10n, b % 10n];
    result += (x >= y ? x - y : y - x) * place;
  }
  return result;
}

function rectangleError(
  rule: ArithmeticRule,
  problem: Extract<MeasureProblem, { kind: 'rectangle' }>,
): readonly string[] {
  const [width, height] = [parseInteger(problem.width), parseInteger(problem.height)];
  if (width === null || height === null) return [];
  const [area, perimeter] = [width * height, 2n * (width + height)];
  const truth = problem.measure === 'area' ? area : perimeter;
  const predicted = ((): bigint[] => {
    switch (rule) {
      case 'swapped-measure':
        return [problem.measure === 'area' ? perimeter : area];
      // 6 by 4: 10, two sides added once each.
      case 'added-two-sides':
        return [width + height];
      // 6 by 4: 36, one side times itself.
      case 'one-side-squared':
        return width === height ? [] : [width * width];
      default:
        return [];
    }
  })();
  return [...new Set(predicted.filter((value) => value !== truth).map(String))];
}

function conversionError(
  rule: ArithmeticRule,
  problem: Extract<MeasureProblem, { kind: 'unit-conversion' }>,
): readonly string[] {
  const amount = parseInteger(problem.amount);
  const factor = conversionFactor(problem.from, problem.to);
  if (amount === null || factor === null) return [];
  const truth = amount * factor;
  const predicted = ((): Rational[] => {
    switch (rule) {
      // 3 m = 0.03 cm: divided when going to a smaller unit.
      case 'divided-instead':
        return [{ numerator: amount, denominator: factor }];
      // 3 m = 30 cm: "times ten" used for every change of unit.
      case 'used-ten':
        return factor === 10n ? [] : [{ numerator: amount * 10n, denominator: 1n }];
      // 3 km = 300 m, or 3 h = 300 min: the wrong power of ten, or an hour taken as a hundred.
      case 'wrong-factor':
        return [{ numerator: amount * (factor === 100n ? 1000n : 100n), denominator: 1n }];
      default:
        return [];
    }
  })();
  return written(predicted, { numerator: truth, denominator: 1n });
}

function statisticError(
  rule: ArithmeticRule,
  problem: Extract<MeasureProblem, { kind: 'statistic' }>,
): readonly string[] {
  const values = problem.values.map((value) => parseRational(value, true));
  if (values.some((value) => value === null)) return [];
  const numbers = values.filter((value): value is Rational => value !== null);
  const truth = statistic(problem.measure, numbers);
  const predicted = ((): Rational[] => {
    switch (rule) {
      // The middle of the list as written, never put in order.
      case 'median-unsorted':
        return problem.measure === 'median' ? [middle(numbers)] : [];
      case 'swapped-measure':
        return [statistic(problem.measure === 'mean' ? 'median' : 'mean', numbers)];
      // The total, never shared out.
      case 'sum-not-divided':
        return problem.measure === 'mean'
          ? [
              {
                numerator: average(numbers).numerator,
                denominator: average(numbers).denominator / BigInt(numbers.length),
              },
            ]
          : [];
      default:
        return [];
    }
  })();
  return written(predicted, truth);
}

function written(predicted: readonly Rational[], truth: Rational): readonly string[] {
  return [
    ...new Set(
      predicted.flatMap((value) =>
        compareRationals(value, truth) === 0 ? [] : [formatDecimal(value) ?? formatFraction(value)],
      ),
    ),
  ];
}
