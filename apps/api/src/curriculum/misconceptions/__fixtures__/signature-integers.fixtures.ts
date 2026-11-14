import type { MisconceptionInput } from '@/curriculum/misconceptions';
import type { ArithmeticProblem } from '@/quality/arithmetic';

import type { SignatureCase } from './signature.fixtures';

/** P3-07: one true positive and one true negative for each integer misconception. */
function on(skillCode: string, expectedAnswer: string, problem: ArithmeticProblem) {
  return (learnerAnswer: string): MisconceptionInput => ({
    skillCode,
    question: null,
    expectedAnswer,
    learnerAnswer,
    problem,
  });
}

const compare = (left: string, right: string, expected: string) =>
  on('INT.CMP', expected, { skillCode: 'INT.CMP', kind: 'integer-comparison', left, right });
const absolute = (number: string, expected: string) =>
  on('INT.ABS', expected, { skillCode: 'INT.ABS', kind: 'absolute-value', number });
const operation = (
  skillCode: 'INT.ADD' | 'INT.MUL',
  op: 'add' | 'subtract' | 'multiply' | 'divide',
  [left, right]: readonly [string, string],
  expected: string,
) => on(skillCode, expected, { skillCode, kind: 'integer-operation', operation: op, left, right });

const twoNegatives = compare('-7', '-3', '<');
const mixed = compare('4', '-2', '>');
const zero = compare('0', '-3', '>');
const negativeSeven = absolute('-7', '7');
const seven = absolute('7', '7');
const addMixed = operation('INT.ADD', 'add', ['-5', '3'], '-2');
const minusNegative = operation('INT.ADD', 'subtract', ['5', '-3'], '8');
const timesMixed = operation('INT.MUL', 'multiply', ['6', '-4'], '-24');
const timesNegatives = operation('INT.MUL', 'multiply', ['-6', '-4'], '24');
const timesFirstNegative = operation('INT.MUL', 'multiply', ['-6', '4'], '-24');

export const INTEGER_SIGNATURE_CASES: readonly SignatureCase[] = [
  {
    id: 'misconception-int-cmp-size-not-sign',
    positive: twoNegatives('>'),
    negative: twoNegatives('<'),
  },
  { id: 'misconception-int-cmp-reversed', positive: mixed('<'), negative: mixed('>') },
  { id: 'misconception-int-cmp-zero-smallest', positive: zero('<'), negative: zero('>') },
  {
    id: 'misconception-int-abs-kept-sign',
    positive: negativeSeven('-7'),
    negative: negativeSeven('7'),
  },
  { id: 'misconception-int-abs-negated', positive: seven('-7'), negative: seven('7') },
  {
    id: 'misconception-int-abs-counted-zero',
    positive: negativeSeven('8'),
    negative: negativeSeven('7'),
  },
  { id: 'misconception-int-add-wrong-sign', positive: addMixed('2'), negative: addMixed('-2') },
  {
    id: 'misconception-int-add-minus-negative',
    positive: minusNegative('2'),
    negative: minusNegative('8'),
  },
  {
    id: 'misconception-int-add-magnitudes-added',
    positive: addMixed('-8'),
    negative: addMixed('-2'),
  },
  {
    id: 'misconception-int-mul-wrong-sign',
    positive: timesMixed('24'),
    negative: timesMixed('-24'),
  },
  {
    id: 'misconception-int-mul-sign-of-first',
    positive: timesNegatives('-24'),
    negative: timesNegatives('24'),
  },
  {
    id: 'misconception-int-mul-added',
    positive: timesFirstNegative('-2'),
    negative: timesFirstNegative('-24'),
  },
];
