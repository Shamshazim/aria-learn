import type { Band } from '@aria/shared';

import type { ArithmeticProblem } from '@/quality/arithmetic';
import type { AlgebraProblem, MeasureProblem } from '@/quality/arithmetic/kinds';

/**
 * Phrasing for the P3-07 strands past the early grades — decimals and percent, integers,
 * ratios, algebra, measurement — split from `phrasing.ts` to keep both under the line limit.
 * Same rule as there: the sentence formats the problem it is given and computes nothing.
 */
type DecimalProblem = Extract<
  ArithmeticProblem,
  { kind: 'decimal-place' | 'decimal-comparison' | 'decimal-operation' | 'percent-of' }
>;

export function isDecimal(problem: ArithmeticProblem): problem is DecimalProblem {
  return problem.kind.startsWith('decimal-') || problem.kind === 'percent-of';
}

type IntegerProblem = Extract<
  ArithmeticProblem,
  { kind: 'integer-comparison' | 'absolute-value' | 'integer-operation' }
>;

export function isInteger(problem: ArithmeticProblem): problem is IntegerProblem {
  return problem.kind.startsWith('integer-') || problem.kind === 'absolute-value';
}

const INTEGER_SIGNS = { add: '+', subtract: '-', multiply: '×', divide: '÷' } as const;
const INTEGER_WORDS = {
  add: 'add',
  subtract: 'take away',
  multiply: 'times',
  divide: 'divided by',
} as const;

/** P3-07: integers. A negative second number goes in brackets, so two signs never touch. */
export function integerPrompt(problem: IntegerProblem, band: Band): string {
  switch (problem.kind) {
    case 'integer-comparison':
      return band === 'senior'
        ? `Compare ${problem.left} and ${problem.right}. Use <, > or =.`
        : `Is ${problem.left} more than, less than, or the same as ${problem.right}?`;
    case 'absolute-value':
      return band === 'senior'
        ? `|${problem.number}| = ?`
        : `What is the absolute value of ${problem.number}?`;
    case 'integer-operation': {
      const right = problem.right.trim().startsWith('-') ? `(${problem.right})` : problem.right;
      return band === 'senior'
        ? `${problem.left} ${INTEGER_SIGNS[problem.operation]} ${right} = ?`
        : `What is ${problem.left} ${INTEGER_WORDS[problem.operation]} ${right}?`;
    }
  }
}

type RatioProblem = Extract<
  ArithmeticProblem,
  { kind: 'ratio-missing' | 'unit-rate' | 'proportion' }
>;

export function isRatio(problem: ArithmeticProblem): problem is RatioProblem {
  return (
    problem.kind === 'ratio-missing' ||
    problem.kind === 'unit-rate' ||
    problem.kind === 'proportion'
  );
}

/** P3-07: ratios, rates and proportion, each in one short everyday sentence and a question. */
export function ratioPrompt(problem: RatioProblem, band: Band): string {
  switch (problem.kind) {
    case 'ratio-missing':
      return band === 'senior'
        ? `${problem.first} : ${problem.second} = ${problem.scaledFirst} : ?`
        : `${problem.first} : ${problem.second} is the same ratio as ${problem.scaledFirst} : ?. What is the missing number?`;
    case 'unit-rate':
      return `${problem.amount} ${problem.amountUnit} in ${problem.per} ${problem.perUnit}s. How many ${problem.amountUnit} in 1 ${problem.perUnit}?`;
    case 'proportion':
      return `${problem.count} ${problem.thing} cost $${problem.total}. How much do ${problem.asked} ${problem.thing} cost?`;
  }
}

/** P3-07: expressions and equations. The expression is shown exactly as written. */
export function algebraPrompt(problem: AlgebraProblem, band: Band): string {
  switch (problem.kind) {
    case 'expression':
      return band === 'senior' ? `${problem.expression} = ?` : `What is ${problem.expression}?`;
    case 'expression-value':
      return `What is ${problem.expression} when ${problem.variable} = ${problem.value}?`;
    case 'equation':
      return `Solve ${problem.left} = ${problem.right}. What is ${problem.variable}?`;
  }
}

/** P3-07: decimals and percent. */
export function decimalPrompt(problem: DecimalProblem, band: Band): string {
  switch (problem.kind) {
    case 'decimal-place':
      return `In ${problem.number}, which digit is in the ${problem.place} place?`;
    case 'decimal-comparison':
      return band === 'senior'
        ? `Compare ${problem.left} and ${problem.right}. Use <, > or =.`
        : `Is ${problem.left} more than, less than, or the same as ${problem.right}?`;
    case 'decimal-operation':
      return band === 'senior'
        ? `${problem.left} ${problem.operation === 'add' ? '+' : '-'} ${problem.right} = ?`
        : `What is ${problem.left} ${problem.operation === 'add' ? 'add' : 'take away'} ${problem.right}?`;
    case 'percent-of':
      return `What is ${problem.percent}% of ${problem.whole}?`;
  }
}

/**
 * A familiar rectangle for each unit. "Rectangle" itself reads above the middle band, and a
 * card, a garden or a book is a rectangle a child can picture at the right size. (Not a photo:
 * the output safety filter blocks the word, rightly, in a children's product.)
 */
const RECTANGLE_THINGS: Readonly<Record<string, string>> = { cm: 'card', m: 'garden', in: 'book' };

/** Time units read as words; the metric symbols (cm, kg, mL) are how a child sees them written. */
const UNIT_NAMES: Readonly<Record<string, string>> = { h: 'hours', min: 'minutes', s: 'seconds' };

function unitName(unit: string): string {
  return UNIT_NAMES[unit] ?? unit;
}

/** P3-07: measurement and data, each as an everyday sentence and one question. */
export function measurePrompt(problem: MeasureProblem): string {
  switch (problem.kind) {
    case 'elapsed-time':
      return `It is ${problem.start}. What time will it be in ${problem.minutes} minutes?`;
    case 'money-change':
      return `Something costs $${problem.cost}. You pay $${problem.paid}. How much change do you get?`;
    case 'rectangle':
      return `A ${RECTANGLE_THINGS[problem.unit] ?? 'card'} is ${problem.width} ${problem.unit} long and ${problem.height} ${problem.unit} wide. What is its ${problem.measure}?`;
    case 'unit-conversion':
      return `How many ${unitName(problem.to)} are in ${problem.amount} ${unitName(problem.from)}?`;
    case 'statistic':
      return `Find the ${problem.measure} of ${problem.values.join(', ')}.`;
  }
}
