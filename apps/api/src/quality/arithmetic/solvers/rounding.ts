import { parseInteger } from '@/quality/arithmetic/normalise';
import { integerVerdict } from '@/quality/arithmetic/solvers/addition';
import type { CheckResult, RoundingProblem } from '@/quality/arithmetic/types';

/**
 * P3-07: rounding a whole number to the nearest ten (3.NBT.A.1). A number ending in 5 rounds
 * up, which is the rule the standard teaches; integer arithmetic only, so nothing here can be
 * wrong by a floating-point half.
 */
export function solveRounding(problem: RoundingProblem, candidate: string): CheckResult {
  const number = parseInteger(problem.number);
  const answer = parseInteger(candidate);
  if (number === null || answer === null || number < 0n) {
    return { verdict: 'undecidable', reason: 'Rounding requires a non-negative whole number.' };
  }
  return integerVerdict(roundToTen(number), answer, 'rounding');
}

export function roundToTen(number: bigint): bigint {
  const ones = number % 10n;
  return ones >= 5n ? number - ones + 10n : number - ones;
}
