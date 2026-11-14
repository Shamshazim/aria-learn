import { formatDecimal } from '@/quality/arithmetic/decimal-format';
import { formatFraction, readFraction } from '@/quality/arithmetic/fraction-format';
import { compareRationals, parseInteger, parseRational } from '@/quality/arithmetic/normalise';
import { integerVerdict } from '@/quality/arithmetic/solvers/addition';
import type {
  CheckResult,
  ElapsedTimeProblem,
  MoneyChangeProblem,
  Rational,
  RectangleProblem,
  StatisticProblem,
  UnitConversionProblem,
} from '@/quality/arithmetic/types';
import { conversionFactor, withoutUnitWords } from '@/quality/arithmetic/units';

/** P3-07: measurement and data, exact. Times are minutes, money is cents, averages are rationals. */
export function solveElapsedTime(problem: ElapsedTimeProblem, candidate: string): CheckResult {
  const start = clockMinutes(problem.start);
  const minutes = parseInteger(problem.minutes);
  if (start === null || minutes === null)
    return { verdict: 'undecidable', reason: 'Needs a clock time and minutes.' };
  const expected = clockText(start + Number(minutes));
  const answer = clockMinutes(candidate.replace(/\s*(?:am|pm|a\.m\.|p\.m\.)\s*$/iu, ''));
  return answer !== null && clockText(answer) === expected
    ? { verdict: 'correct', expected, reason: 'Exact clock time matches.' }
    : { verdict: 'incorrect', expected, reason: 'Exact clock time differs.' };
}

/** "2:45" or "2.45" as minutes past twelve; `null` for anything that is not a real time. */
export function clockMinutes(text: string): number | null {
  const match = /^\s*(\d{1,2})[:.](\d{2})\s*$/u.exec(text);
  if (match === null) return null;
  const [hour, minute] = [Number(match[1]), Number(match[2])];
  return hour < 1 || hour > 12 || minute > 59 ? null : (hour % 12) * 60 + minute;
}

/** Minutes past twelve as a 12-hour clock: 0 is "12:00", 195 is "3:15". */
export function clockText(minutes: number): string {
  const within = ((minutes % 720) + 720) % 720;
  const hour = Math.floor(within / 60) || 12;
  return `${String(hour)}:${String(within % 60).padStart(2, '0')}`;
}

export function solveMoneyChange(problem: MoneyChangeProblem, candidate: string): CheckResult {
  const [paid, cost] = [cents(problem.paid), cents(problem.cost)];
  if (paid === null || cost === null || cost > paid) {
    return { verdict: 'undecidable', reason: 'Change needs a payment at least the cost.' };
  }
  const expected = dollars(paid - cost);
  const answer = cents(candidate);
  return answer === paid - cost
    ? { verdict: 'correct', expected, reason: 'Exact change in cents matches.' }
    : { verdict: 'incorrect', expected, reason: 'Exact change in cents differs.' };
}

/**
 * Money as whole cents: "$1.55", "1.55", "1.5", "155 cents", "155c" and "155¢" are all 155.
 * A plain number is dollars, as a price is written; only a cents word makes it cents.
 */
export function cents(text: string): bigint | null {
  const inCents = /^\s*(\d+)\s*(?:c|¢|cents?)\s*$/iu.exec(text);
  if (inCents !== null) return BigInt(inCents[1] ?? '0');
  const value = parseRational(
    text
      .trim()
      .replace(/^\$\s*/u, '')
      .replace(/\s*dollars?\s*$/iu, ''),
    true,
  );
  if (value === null) return null;
  const scaled = value.numerator * 100n;
  return scaled % value.denominator === 0n ? scaled / value.denominator : null;
}

export function dollars(amount: bigint): string {
  return `$${(amount / 100n).toString()}.${(amount % 100n).toString().padStart(2, '0')}`;
}

export function solveRectangle(problem: RectangleProblem, candidate: string): CheckResult {
  const [width, height] = [parseInteger(problem.width), parseInteger(problem.height)];
  if (width === null || height === null)
    return { verdict: 'undecidable', reason: 'A rectangle needs two sides.' };
  const truth = problem.measure === 'area' ? width * height : 2n * (width + height);
  return wholeAnswer(truth, candidate, problem.measure);
}

export function solveUnitConversion(
  problem: UnitConversionProblem,
  candidate: string,
): CheckResult {
  const amount = parseInteger(problem.amount);
  const factor = conversionFactor(problem.from, problem.to);
  if (amount === null || factor === null) {
    return { verdict: 'undecidable', reason: 'That conversion is not in the table.' };
  }
  return wholeAnswer(amount * factor, candidate, 'conversion');
}

function wholeAnswer(truth: bigint, candidate: string, operation: string): CheckResult {
  const answer = parseInteger(withoutUnitWords(candidate));
  if (answer === null)
    return { verdict: 'incorrect', expected: truth.toString(), reason: 'Not a whole number.' };
  return integerVerdict(truth, answer, operation);
}

export function solveStatistic(problem: StatisticProblem, candidate: string): CheckResult {
  const values = problem.values.map((value) => parseRational(value, true));
  if (values.some((value) => value === null)) {
    return { verdict: 'undecidable', reason: 'An average needs numbers.' };
  }
  const truth = statistic(
    problem.measure,
    values.filter((value): value is Rational => value !== null),
  );
  const expected = formatDecimal(truth) ?? formatFraction(truth);
  const answer = readFraction(candidate);
  return answer !== null && compareRationals(truth, answer) === 0
    ? { verdict: 'correct', expected, reason: `Exact ${problem.measure} matches.` }
    : { verdict: 'incorrect', expected, reason: `Exact ${problem.measure} differs.` };
}

/** The mean, or the median of the sorted values (the mean of the middle two when there is no one middle). */
export function statistic(measure: 'mean' | 'median', values: readonly Rational[]): Rational {
  if (measure === 'mean') return average(values);
  const sorted = [...values].sort(compareRationals);
  return middle(sorted);
}

export function middle(values: readonly Rational[]): Rational {
  const half = Math.floor(values.length / 2);
  const upper = values[half] ?? { numerator: 0n, denominator: 1n };
  const lower = values[half - 1] ?? upper;
  return values.length % 2 === 1 ? upper : average([lower, upper]);
}

export function average(values: readonly Rational[]): Rational {
  const sum = values.reduce<Rational>(
    (total, value) => ({
      numerator: total.numerator * value.denominator + value.numerator * total.denominator,
      denominator: total.denominator * value.denominator,
    }),
    { numerator: 0n, denominator: 1n },
  );
  return { numerator: sum.numerator, denominator: sum.denominator * BigInt(values.length) };
}
