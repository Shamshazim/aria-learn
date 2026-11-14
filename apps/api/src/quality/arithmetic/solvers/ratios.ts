import { readFraction } from '@/quality/arithmetic/fraction-format';
import { compareRationals, parseInteger } from '@/quality/arithmetic/normalise';
import { integerVerdict } from '@/quality/arithmetic/solvers/addition';
import type {
  CheckResult,
  ProportionProblem,
  RatioMissingProblem,
  UnitRateProblem,
} from '@/quality/arithmetic/types';

/**
 * P3-07: ratios, rates and proportion, exact. A child may answer with the unit or the dollar
 * sign ("12 km", "$20"); those are read past, because the number is what is being checked.
 */
export function solveRatioMissing(problem: RatioMissingProblem, candidate: string): CheckResult {
  const [first, second, scaled] = [problem.first, problem.second, problem.scaledFirst].map(
    parseInteger,
  );
  if (
    first == null ||
    second == null ||
    scaled == null ||
    first === 0n ||
    (scaled * second) % first !== 0n
  ) {
    return { verdict: 'undecidable', reason: 'No whole number completes this ratio.' };
  }
  return wholeVerdict((scaled * second) / first, candidate, 'missing ratio term');
}

export function solveUnitRate(problem: UnitRateProblem, candidate: string): CheckResult {
  const amount = parseInteger(problem.amount);
  const per = parseInteger(problem.per);
  if (amount === null || per === null || per === 0n) {
    return { verdict: 'undecidable', reason: 'A unit rate needs an amount and a non-zero count.' };
  }
  const truth = { numerator: amount, denominator: per };
  const answer = readFraction(withoutUnits(candidate));
  const expected =
    amount % per === 0n ? (amount / per).toString() : `${amount.toString()}/${per.toString()}`;
  return answer !== null && compareRationals(truth, answer) === 0
    ? { verdict: 'correct', expected, reason: 'Exact unit rate matches.' }
    : { verdict: 'incorrect', expected, reason: 'Exact unit rate differs.' };
}

export function solveProportion(problem: ProportionProblem, candidate: string): CheckResult {
  const [count, total, asked] = [problem.count, problem.total, problem.asked].map(parseInteger);
  if (
    count == null ||
    total == null ||
    asked == null ||
    count === 0n ||
    (total * asked) % count !== 0n
  ) {
    return { verdict: 'undecidable', reason: 'This proportion has no whole-number answer.' };
  }
  return wholeVerdict((total * asked) / count, candidate, 'proportion');
}

function wholeVerdict(expected: bigint, candidate: string, operation: string): CheckResult {
  const answer = parseInteger(withoutUnits(candidate));
  if (answer === null) {
    return { verdict: 'incorrect', expected: expected.toString(), reason: 'Not a whole number.' };
  }
  return integerVerdict(expected, answer, operation);
}

/** "$20", "20 dollars", "12 km", "12 km per hour" → "20" / "12". */
export function withoutUnits(candidate: string): string {
  return candidate
    .trim()
    .replace(/^\$\s*/u, '')
    .replace(/\s+[a-z][a-z\s]*$/iu, '');
}
