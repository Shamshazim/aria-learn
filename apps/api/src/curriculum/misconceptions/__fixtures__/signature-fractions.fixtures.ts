import type { MisconceptionInput } from '@/curriculum/misconceptions';
import type { ArithmeticProblem } from '@/quality/arithmetic';

import type { SignatureCase } from './signature.fixtures';

/** P3-07: one true positive and one true negative for each new fraction misconception. */
function on(
  skillCode: string,
  question: string,
  expectedAnswer: string,
  problem: ArithmeticProblem,
) {
  return (learnerAnswer: string): MisconceptionInput => ({
    skillCode,
    question,
    expectedAnswer,
    learnerAnswer,
    problem,
  });
}

const equiv = on('FRAC.EQUIV', '2/3 = ?/12', '8', {
  skillCode: 'FRAC.EQUIV',
  kind: 'fraction-missing',
  left: '2/3',
  denominator: '12',
});
const like = on('FRAC.ADD.LIKE', 'What is 3/8 add 2/8?', '5/8', {
  skillCode: 'FRAC.ADD.LIKE',
  kind: 'fraction-operation',
  operation: 'add',
  left: '3/8',
  right: '2/8',
});
const unlike = on('FRAC.ADD.UNLIKE', 'What is 1/2 add 1/3?', '5/6', {
  skillCode: 'FRAC.ADD.UNLIKE',
  kind: 'fraction-operation',
  operation: 'add',
  left: '1/2',
  right: '1/3',
});
const times = on('FRAC.MUL.WHOLE', 'What is 3 times 2/5?', '1 1/5', {
  skillCode: 'FRAC.MUL.WHOLE',
  kind: 'fraction-operation',
  operation: 'multiply',
  left: '3',
  right: '2/5',
});

export const FRACTION_SIGNATURE_CASES: readonly SignatureCase[] = [
  { id: 'misconception-frac-equiv-additive', positive: equiv('11'), negative: equiv('8') },
  { id: 'misconception-frac-equiv-kept-numerator', positive: equiv('2'), negative: equiv('8') },
  { id: 'misconception-frac-equiv-answered-factor', positive: equiv('4'), negative: equiv('8') },
  {
    id: 'misconception-frac-add-like-combined-denominators',
    positive: like('5/16'),
    negative: like('5/8'),
  },
  { id: 'misconception-frac-add-like-numerator-only', positive: like('5'), negative: like('5/8') },
  { id: 'misconception-frac-add-like-flipped', positive: like('1/8'), negative: like('5/8') },
  {
    id: 'misconception-frac-add-unlike-combined-denominators',
    positive: unlike('2/5'),
    negative: unlike('5/6'),
  },
  {
    id: 'misconception-frac-add-unlike-kept-one-denominator',
    positive: unlike('2/3'),
    negative: unlike('5/6'),
  },
  {
    id: 'misconception-frac-add-unlike-renamed-bottoms-only',
    positive: unlike('2/6'),
    negative: unlike('5/6'),
  },
  {
    id: 'misconception-frac-mul-whole-multiplied-both',
    positive: times('6/15'),
    negative: times('1 1/5'),
  },
  {
    id: 'misconception-frac-mul-whole-added-whole',
    positive: times('3 2/5'),
    negative: times('6/5'),
  },
  {
    id: 'misconception-frac-mul-whole-multiplied-denominator',
    positive: times('2/15'),
    negative: times('1 1/5'),
  },
];
