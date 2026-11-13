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
  if (problem.kind === 'sequence') return sequencePrompt(problem.values, band);
  if (isOperation(problem)) return operationPrompt(problem, band);
  if (isFraction(problem)) return fractionPrompt(problem, band);
  // Only the number-sense kinds are left; a new kind that is none of these fails to compile.
  return numberSensePrompt(problem, band);
}

type OperationProblem = Extract<
  ArithmeticProblem,
  { kind: 'addition' | 'subtraction' | 'multiplication' | 'division' }
>;
type FractionProblem = Extract<
  ArithmeticProblem,
  { kind: 'fraction-equality' | 'fraction-comparison' | 'fraction-missing' | 'fraction-operation' }
>;

const OPERATION_KINDS: ReadonlySet<string> = new Set([
  'addition',
  'subtraction',
  'multiplication',
  'division',
]);

function isOperation(problem: ArithmeticProblem): problem is OperationProblem {
  return OPERATION_KINDS.has(problem.kind);
}

function isFraction(problem: ArithmeticProblem): problem is FractionProblem {
  return problem.kind.startsWith('fraction-');
}

/** P3-07: place value, comparing and rounding whole numbers. */
function numberSensePrompt(
  problem: Extract<ArithmeticProblem, { kind: 'place-value' | 'whole-comparison' | 'rounding' }>,
  band: Band,
): string {
  switch (problem.kind) {
    case 'place-value':
      return band === 'early'
        ? `Look at ${problem.number}. Which digit is in the ${problem.place} place?`
        : `In ${problem.number}, which digit is in the ${problem.place} place?`;
    case 'whole-comparison':
      return band === 'early'
        ? `Is ${problem.left} more than, less than, or the same as ${problem.right}?`
        : `Compare ${problem.left} and ${problem.right}. Use <, > or =.`;
    case 'rounding':
      return `Round ${problem.number} to the nearest ten.`;
  }
}

/** Fractions: equal, compared, equivalent, and the operations in words below the senior band. */
function fractionPrompt(
  problem: Extract<
    ArithmeticProblem,
    {
      kind: 'fraction-equality' | 'fraction-comparison' | 'fraction-missing' | 'fraction-operation';
    }
  >,
  band: Band,
): string {
  if (problem.kind === 'fraction-equality')
    return `Are ${problem.left} and ${problem.right} equal?`;
  if (problem.kind === 'fraction-comparison') {
    return band === 'early'
      ? `Which is more, ${problem.left} or ${problem.right}?`
      : `Compare ${problem.left} and ${problem.right}.`;
  }
  if (problem.kind === 'fraction-missing') {
    return band === 'senior'
      ? `${problem.left} = ?/${problem.denominator}`
      : `${problem.left} = ?/${problem.denominator}. What is the missing number?`;
  }
  const { left, right } = problem;
  if (band === 'senior') return `${left} ${FRACTION_SIGNS[problem.operation]} ${right} = ?`;
  return `What is ${left} ${FRACTION_WORDS[problem.operation]} ${right}?`;
}

const FRACTION_SIGNS = { add: '+', subtract: '-', multiply: '×' } as const;
const FRACTION_WORDS = { add: 'add', subtract: 'take away', multiply: 'times' } as const;

/** The four operations, each in the words its band is taught. */
function operationPrompt(
  problem: Extract<
    ArithmeticProblem,
    { kind: 'addition' | 'subtraction' | 'multiplication' | 'division' }
  >,
  band: Band,
): string {
  switch (problem.kind) {
    case 'addition':
      return additionPrompt(problem.left, problem.right, band);
    case 'subtraction':
      return subtractionPrompt(problem.left, problem.right, band);
    case 'multiplication':
      return band === 'senior'
        ? `${problem.left} × ${problem.right} = ?`
        : `What is ${problem.left} times ${problem.right}?`;
    case 'division':
      return divisionPrompt(problem.skillCode, problem.left, problem.right, band);
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

/** P3-07: "take away" is the words the early bands are taught; older children read the sign. */
function subtractionPrompt(left: string, right: string, band: Band): string {
  if (band === 'senior') return `${left} - ${right} = ?`;
  const first = band === 'early' ? word(left) : null;
  const second = band === 'early' ? word(right) : null;
  return first === null || second === null
    ? `What is ${left} take away ${right}?`
    : `What is ${first} take away ${second}?`;
}

/** P3-07: long division says how to write what is left over (the word "remainder" reads above middle). */
function divisionPrompt(skillCode: string, left: string, right: string, band: Band): string {
  const asked =
    band === 'senior' ? `${left} ÷ ${right} = ?` : `What is ${left} divided by ${right}?`;
  return skillCode === 'DIV.LONG' ? `${asked} Write what is left over after an r.` : asked;
}

/** `null` above ten: spelling out forty-eight makes the sentence harder, not easier. */
function word(value: string): string | null {
  return WORDS[Number.parseInt(value, 10)] ?? null;
}
