import type { MisconceptionInput } from '@/curriculum/misconceptions';
import type { ArithmeticProblem } from '@/quality/arithmetic';

import type { SignatureCase } from './signature.fixtures';

/** P3-07: one true positive and one true negative for each expression and equation idea. */
function on(skillCode: string, expectedAnswer: string, problem: ArithmeticProblem) {
  return (learnerAnswer: string): MisconceptionInput => ({
    skillCode,
    question: null,
    expectedAnswer,
    learnerAnswer,
    problem,
  });
}

const order = (expression: string, expected: string) =>
  on('EXP.ORDER', expected, { skillCode: 'EXP.ORDER', kind: 'expression', expression });
const plainOrder = order('3 + 4 × 2', '11');
const bracketed = order('(3 + 4) × 2', '14');
const timesFirst = order('2 × 3 + 4', '10');
const value = on('EXP.EVAL', '19', {
  skillCode: 'EXP.EVAL',
  kind: 'expression-value',
  expression: '3n + 4',
  variable: 'n',
  value: '5',
});
const oneStep = on('EQN.ONE', '8', {
  skillCode: 'EQN.ONE',
  kind: 'equation',
  left: 'x + 7',
  right: '15',
  variable: 'x',
});
const twoStep = on('EQN.TWO', '5', {
  skillCode: 'EQN.TWO',
  kind: 'equation',
  left: '3x + 4',
  right: '19',
  variable: 'x',
});

export const ALGEBRA_SIGNATURE_CASES: readonly SignatureCase[] = [
  {
    id: 'misconception-exp-order-left-to-right',
    positive: plainOrder('14'),
    negative: plainOrder('11'),
  },
  {
    id: 'misconception-exp-order-ignored-brackets',
    positive: bracketed('11'),
    negative: bracketed('14'),
  },
  {
    id: 'misconception-exp-order-addition-first',
    positive: timesFirst('14'),
    negative: timesFirst('10'),
  },
  { id: 'misconception-exp-eval-concatenated', positive: value('39'), negative: value('19') },
  { id: 'misconception-exp-eval-added', positive: value('12'), negative: value('19') },
  { id: 'misconception-exp-eval-ignored', positive: value('9'), negative: value('19') },
  { id: 'misconception-eqn-one-wrong-inverse', positive: oneStep('22'), negative: oneStep('8') },
  { id: 'misconception-eqn-one-kept-right', positive: oneStep('15'), negative: oneStep('8') },
  { id: 'misconception-eqn-one-operand', positive: oneStep('7'), negative: oneStep('8') },
  { id: 'misconception-eqn-two-stopped', positive: twoStep('15'), negative: twoStep('5') },
  { id: 'misconception-eqn-two-divided-first', positive: twoStep('2 1/3'), negative: twoStep('5') },
  { id: 'misconception-eqn-two-wrong-inverse', positive: twoStep('69'), negative: twoStep('5') },
];
