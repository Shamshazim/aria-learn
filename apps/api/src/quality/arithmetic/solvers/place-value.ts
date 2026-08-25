import { parseInteger } from '@/quality/arithmetic/normalise';
import { integerVerdict } from '@/quality/arithmetic/solvers/addition';
import type { CheckResult, PlaceValueProblem } from '@/quality/arithmetic/types';

const PLACE_DIVISOR: Readonly<Record<PlaceValueProblem['place'], bigint>> = {
  ones: 1n,
  tens: 10n,
  hundreds: 100n,
  thousands: 1_000n,
};

export function solvePlaceValue(problem: PlaceValueProblem, candidate: string): CheckResult {
  const number = parseInteger(problem.number);
  const answer = parseInteger(candidate);
  if (number === null || answer === null || number < 0n) {
    return { verdict: 'undecidable', reason: 'Place value requires a non-negative whole number.' };
  }
  const digit = (number / PLACE_DIVISOR[problem.place]) % 10n;
  return integerVerdict(digit, answer, 'place-value digit');
}
