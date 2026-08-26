import type { Band } from '@aria/shared';

import type { ArithmeticProblem } from '@/quality/arithmetic';

/** Number words up to ten; below that a digit on the page is harder than the word out loud. */
const WORDS: readonly string[] = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
];

/**
 * The sentence a child reads, for a problem the checker has already proven (P2H-10).
 *
 * Deterministic, and the same numbers as the problem by construction: the phrasing never
 * computes anything, it only formats what it was handed. A model is allowed to wrap this in a
 * story for the older bands, and `word-problem.ts` is what proves the story kept the numbers.
 */
export function phraseItem(problem: ArithmeticProblem, band: Band): string {
  switch (problem.kind) {
    case 'sequence':
      return sequencePrompt(problem.values, band);
    case 'addition':
      return additionPrompt(problem.left, problem.right, band);
    case 'fraction-equality':
      return `Are ${problem.left} and ${problem.right} equal?`;
    case 'fraction-comparison':
      return band === 'early'
        ? `Which is more, ${problem.left} or ${problem.right}?`
        : `Compare ${problem.left} and ${problem.right}.`;
  }
}

function sequencePrompt(values: readonly string[], band: Band): string {
  const shown = values.join(', ');
  return band === 'early'
    ? `${shown}. What is next?`
    : `The pattern is ${shown}. What number comes next?`;
}

function additionPrompt(left: string, right: string, band: Band): string {
  if (band === 'senior') return `${left} + ${right} = ?`;
  const first = band === 'early' ? word(left) : null;
  const second = band === 'early' ? word(right) : null;
  return first === null || second === null
    ? `What is ${left} add ${right}?`
    : `What is ${first} add ${second}?`;
}

/** `null` above ten: spelling out forty-eight makes the sentence harder, not easier. */
function word(value: string): string | null {
  return WORDS[Number.parseInt(value, 10)] ?? null;
}
