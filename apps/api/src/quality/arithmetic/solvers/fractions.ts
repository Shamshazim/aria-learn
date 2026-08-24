import { compareRationals, parseRational } from '@/quality/arithmetic/normalise';
import type { CheckResult, FractionEqualityProblem } from '@/quality/arithmetic/types';

export function solveFractionEquality(
  problem: FractionEqualityProblem,
  candidate: string,
): CheckResult {
  const left = parseRational(problem.left, false);
  const right = parseRational(problem.right, false);
  const answer = normaliseEquality(candidate);
  if (left === null || right === null || answer === null) {
    return { verdict: 'undecidable', reason: 'Fraction equality requires exact fractions.' };
  }

  const expected = compareRationals(left, right) === 0 ? 'equal' : 'not equal';
  return answer === expected
    ? { verdict: 'correct', expected, reason: 'Exact cross-products prove the relation.' }
    : { verdict: 'incorrect', expected, reason: 'Exact cross-products disprove the relation.' };
}

function normaliseEquality(candidate: string): 'equal' | 'not equal' | null {
  const value = candidate.trim().toLowerCase();
  if (['=', 'equal', 'yes', 'true'].includes(value)) return 'equal';
  if (['≠', 'not equal', 'no', 'false'].includes(value)) return 'not equal';
  return null;
}
