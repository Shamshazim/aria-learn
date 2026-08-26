import { predictArithmeticError } from '@/curriculum/misconceptions/derived-arithmetic';
import { predictTextError } from '@/curriculum/misconceptions/derived-text';
import type {
  ArithmeticRule,
  DerivedRule,
  MisconceptionInput,
  MisconceptionSignature,
} from '@/curriculum/misconceptions/signature.types';

/** Exhaustive by construction: a new arithmetic rule will not compile until it is listed. */
const ARITHMETIC_RULES: Readonly<Record<ArithmeticRule, true>> = {
  'place-independent-sum': true,
  'dropped-carry': true,
  'carried-ones-digit': true,
  'names-an-operand': true,
  'subtracted-instead': true,
  'counted-by-one': true,
  'restarted-count': true,
  'repeats-last': true,
  'larger-denominator-wins': true,
  'reversed-comparison': true,
  'says-unequal-for-equivalent': true,
  'says-equal-for-same-numerator': true,
  'says-equal-for-same-denominator': true,
};

/** Whether this answer carries this wrong idea. */
export function matchesSignature(
  signature: MisconceptionSignature,
  input: MisconceptionInput,
): boolean {
  const answer = normalise(input.learnerAnswer);
  if (answer === '') return false;
  switch (signature.kind) {
    case 'exact':
      return signature.answers.some((candidate) => normalise(candidate) === answer);
    case 'pattern':
      return new RegExp(signature.pattern, 'u').test(answer);
    case 'off-by':
      return offBy(answer, input.expectedAnswer, signature.delta);
    case 'key-without-suffix':
      return withSuffix(answer, input.expectedAnswer, signature.suffix);
    case 'key-with-suffix':
      return withSuffix(input.expectedAnswer, answer, signature.suffix);
    case 'shares-key-prefix':
      return sharesPrefix(answer, input.expectedAnswer, signature.length);
    case 'shares-question-prefix':
      return (
        answer !== normalise(input.expectedAnswer ?? '') &&
        sharesPrefix(answer, lastWord(input.question), signature.length)
      );
    case 'derived':
      return predict(signature.rule, input).includes(answer);
  }
}

/**
 * The answers this wrong idea would produce, for building a distractor that offers it.
 *
 * Only the rules that *construct* an answer can do this. `pattern` and `shares-key-prefix`
 * recognise a shape without naming a member of it, so they contribute nothing here and the
 * distractor builder falls back to a plain near-miss.
 */
export function predictedAnswers(
  signature: MisconceptionSignature,
  input: MisconceptionInput,
): readonly string[] {
  switch (signature.kind) {
    case 'exact':
      return signature.answers.map((answer) => normalise(answer));
    case 'off-by':
      return offByAnswer(input.expectedAnswer, signature.delta);
    case 'key-without-suffix':
      return trimmed(input.expectedAnswer, signature.suffix);
    case 'key-with-suffix':
      return appended(input.expectedAnswer, signature.suffix);
    case 'derived':
      return predict(signature.rule, input);
    default:
      return [];
  }
}

function predict(rule: DerivedRule, input: MisconceptionInput): readonly string[] {
  return isArithmeticRule(rule)
    ? predictArithmeticError(rule, input.problem)
    : predictTextError(rule, input);
}

function isArithmeticRule(rule: DerivedRule): rule is ArithmeticRule {
  return Object.hasOwn(ARITHMETIC_RULES, rule);
}

function offBy(answer: string, expected: string | null, delta: number): boolean {
  return offByAnswer(expected, delta).includes(answer);
}

function offByAnswer(expected: string | null, delta: number): readonly string[] {
  const key = Number.parseInt(normalise(expected ?? ''), 10);
  return Number.isNaN(key) ? [] : [String(key + delta)];
}

function withSuffix(shortText: string | null, longText: string | null, suffix: string): boolean {
  return trimmed(longText, suffix).includes(normalise(shortText ?? ''));
}

function trimmed(text: string | null, suffix: string): readonly string[] {
  const value = normalise(text ?? '');
  return value.length > suffix.length && value.endsWith(suffix)
    ? [value.slice(0, -suffix.length)]
    : [];
}

function appended(text: string | null, suffix: string): readonly string[] {
  const value = normalise(text ?? '');
  return value === '' || value.endsWith(suffix) ? [] : [value + suffix];
}

function sharesPrefix(answer: string, expected: string | null, length: number): boolean {
  const key = normalise(expected ?? '');
  return (
    key.length >= length &&
    answer.length >= length &&
    answer !== key &&
    answer.slice(0, length) === key.slice(0, length)
  );
}

/** The word a rhyme question is about: the last one in it, punctuation stripped. */
function lastWord(question: string | null): string | null {
  const words = normalise(question ?? '')
    .replaceAll(/[^a-z0-9\s]/gu, '')
    .split(' ')
    .filter((word) => word !== '');
  return words.at(-1) ?? null;
}

function normalise(value: string): string {
  return value.trim().toLocaleLowerCase().replaceAll(/\s+/gu, ' ');
}
