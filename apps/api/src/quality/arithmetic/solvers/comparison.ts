import { compareRationals, parseInteger, parseRational } from '@/quality/arithmetic/normalise';
import type {
  CheckResult,
  FractionComparisonProblem,
  SequenceProblem,
} from '@/quality/arithmetic/types';

export function solveFractionComparison(
  problem: FractionComparisonProblem,
  candidate: string,
): CheckResult {
  const left = parseRational(problem.left, false);
  const right = parseRational(problem.right, false);
  const answer = normaliseComparison(candidate);
  if (left === null || right === null || answer === null) {
    return { verdict: 'undecidable', reason: 'Fraction comparison requires exact fractions.' };
  }

  const relation = compareRationals(left, right);
  const expected = relation < 0 ? '<' : relation > 0 ? '>' : '=';
  return answer === expected
    ? { verdict: 'correct', expected, reason: 'Exact cross-products prove the comparison.' }
    : { verdict: 'incorrect', expected, reason: 'Exact cross-products disprove the comparison.' };
}

export function solveSequence(problem: SequenceProblem, candidate: string): CheckResult {
  const values = problem.values.map(parseInteger);
  const step = parseInteger(problem.step);
  const answer = parseInteger(candidate);
  const last = values.at(-1);
  if (
    values.length === 0 ||
    values.includes(null) ||
    step === null ||
    answer === null ||
    last == null
  ) {
    return {
      verdict: 'undecidable',
      reason: 'Counting requires a non-empty whole-number sequence.',
    };
  }

  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1];
    const current = values[index];
    if (previous == null || current == null || current - previous !== step) {
      return { verdict: 'undecidable', reason: 'The supplied sequence does not match its step.' };
    }
  }
  return sequenceVerdict(last + step, answer);
}

function normaliseComparison(candidate: string): '<' | '=' | '>' | null {
  const value = candidate.trim().toLowerCase();
  if (['<', 'less', 'less than'].includes(value)) return '<';
  if (['=', 'equal', 'equal to'].includes(value)) return '=';
  if (['>', 'greater', 'greater than'].includes(value)) return '>';
  return null;
}

function sequenceVerdict(expected: bigint, answer: bigint): CheckResult {
  return answer === expected
    ? { verdict: 'correct', expected: expected.toString(), reason: 'Exact sequence step matches.' }
    : {
        verdict: 'incorrect',
        expected: expected.toString(),
        reason: 'Exact sequence step differs.',
      };
}
