import type { ArithmeticRule } from '@/curriculum/misconceptions/signature.types';
import { compareRationals, parseInteger, parseRational } from '@/quality/arithmetic/normalise';
import type {
  AdditionProblem,
  ArithmeticProblem,
  Rational,
  SequenceProblem,
} from '@/quality/arithmetic/types';

/**
 * What each wrong idea would produce for this problem (P2H-10).
 *
 * Every rule returns the answers it predicts, not a boolean, because the same computation has
 * two jobs: recognising the wrong idea in what a child said, and building the distractor that
 * offers it. Deriving both from one function is what keeps a wrong tap meaningful — a
 * distractor and the misconception it detects can never drift apart.
 */
export function predictArithmeticError(
  rule: ArithmeticRule,
  problem: ArithmeticProblem | null,
): readonly string[] {
  if (problem === null) return [];
  if (problem.kind === 'addition') return additionError(rule, problem);
  if (problem.kind === 'sequence') return sequenceError(rule, problem);
  return fractionError(rule, problem.kind, problem.left, problem.right);
}

function additionError(rule: ArithmeticRule, problem: AdditionProblem): readonly string[] {
  const left = parseInteger(problem.left);
  const right = parseInteger(problem.right);
  if (left === null || right === null) return [];
  const ones = (left % 10n) + (right % 10n);
  const tens = left / 10n + right / 10n;
  switch (rule) {
    case 'place-independent-sum':
      return ones < 10n ? [] : [`${tens.toString()}${ones.toString()}`];
    case 'dropped-carry':
      return ones < 10n ? [] : [(tens * 10n + (ones % 10n)).toString()];
    case 'carried-ones-digit':
      return ones < 10n ? [] : [`${(tens + (ones % 10n)).toString()}${(ones / 10n).toString()}`];
    case 'names-an-operand':
      return [left.toString(), right.toString()];
    case 'subtracted-instead':
      return [(left > right ? left - right : right - left).toString()];
    default:
      return [];
  }
}

function sequenceError(rule: ArithmeticRule, problem: SequenceProblem): readonly string[] {
  const values = problem.values.map((value) => parseInteger(value));
  const step = parseInteger(problem.step);
  const first = values[0];
  const last = values.at(-1);
  if (step === null || first == null || last == null) return [];
  switch (rule) {
    case 'counted-by-one':
      return step === 1n ? [] : [(last + 1n).toString()];
    case 'restarted-count':
      return [first.toString()];
    case 'repeats-last':
      return [last.toString()];
    default:
      return [];
  }
}

/** The comparison and equality wrong ideas, which answer with a relation rather than a number. */
function fractionError(
  rule: ArithmeticRule,
  kind: 'fraction-comparison' | 'fraction-equality',
  leftText: string,
  rightText: string,
): readonly string[] {
  const left = parseRational(leftText, false);
  const right = parseRational(rightText, false);
  if (left === null || right === null) return [];
  const truth = compareRationals(left, right);
  // Written form, not reduced value: `parseRational` turns 2/4 into 1/2, and the wrong idea
  // this rule is about is exactly a pair that is equal and does not look it.
  const writtenDifferently = leftText.trim() !== rightText.trim();
  const wrong = fractionRelation(rule, { left, right, truth, writtenDifferently });
  if (wrong === null) return [];
  return kind === 'fraction-comparison' ? [wrong] : [wrong === '=' ? 'equal' : 'not equal'];
}

function fractionRelation(
  rule: ArithmeticRule,
  fractions: Readonly<{
    left: Rational;
    right: Rational;
    truth: -1 | 0 | 1;
    writtenDifferently: boolean;
  }>,
): '<' | '=' | '>' | null {
  const { left, right, truth, writtenDifferently } = fractions;
  switch (rule) {
    case 'larger-denominator-wins':
      return unless(compare(left.denominator, right.denominator), truth);
    case 'reversed-comparison':
      return truth === 0 ? null : truth < 0 ? '>' : '<';
    case 'says-equal-for-same-numerator':
      return left.numerator === right.numerator ? unless(0, truth) : null;
    case 'says-equal-for-same-denominator':
      return left.denominator === right.denominator ? unless(0, truth) : null;
    case 'says-unequal-for-equivalent':
      return truth === 0 && writtenDifferently ? '<' : null;
    default:
      return null;
  }
}

/** A wrong idea that happens to agree with the truth here is not a wrong answer. */
function unless(claimed: -1 | 0 | 1, truth: -1 | 0 | 1): '<' | '=' | '>' | null {
  if (claimed === truth) return null;
  return claimed < 0 ? '<' : claimed > 0 ? '>' : '=';
}

function compare(left: bigint, right: bigint): -1 | 0 | 1 {
  return left < right ? -1 : left > right ? 1 : 0;
}
