import type { MisconceptionInput } from '@/curriculum/misconceptions';
import type { ArithmeticProblem } from '@/quality/arithmetic';

import type { SignatureCase } from './signature.fixtures';

/** P3-07: one true positive and one true negative for each ratio and fraction-division idea. */
function on(skillCode: string, expectedAnswer: string, problem: ArithmeticProblem) {
  return (learnerAnswer: string): MisconceptionInput => ({
    skillCode,
    question: null,
    expectedAnswer,
    learnerAnswer,
    problem,
  });
}

const ratio = on('RAT.EQUIV', '12', {
  skillCode: 'RAT.EQUIV',
  kind: 'ratio-missing',
  first: '2',
  second: '3',
  scaledFirst: '8',
});
const rate = on('RAT.UNIT', '12', {
  skillCode: 'RAT.UNIT',
  kind: 'unit-rate',
  amount: '48',
  per: '4',
  amountUnit: 'km',
  perUnit: 'hour',
});
const pens = on('RAT.PROP', '20', {
  skillCode: 'RAT.PROP',
  kind: 'proportion',
  count: '3',
  total: '12',
  asked: '5',
  thing: 'pens',
});
const divide = on('FRAC.DIV', '6', {
  skillCode: 'FRAC.DIV',
  kind: 'fraction-operation',
  operation: 'divide',
  left: '3/4',
  right: '1/8',
});

export const RATIO_SIGNATURE_CASES: readonly SignatureCase[] = [
  { id: 'misconception-rat-equiv-additive', positive: ratio('9'), negative: ratio('12') },
  { id: 'misconception-rat-equiv-kept-second', positive: ratio('3'), negative: ratio('12') },
  { id: 'misconception-rat-equiv-answered-scale', positive: ratio('4'), negative: ratio('12') },
  { id: 'misconception-rat-unit-multiplied', positive: rate('192'), negative: rate('12') },
  { id: 'misconception-rat-unit-subtracted', positive: rate('44'), negative: rate('12') },
  { id: 'misconception-rat-unit-additive', positive: rate('45'), negative: rate('12') },
  { id: 'misconception-rat-prop-additive', positive: pens('14'), negative: pens('20') },
  { id: 'misconception-rat-prop-kept-total', positive: pens('12'), negative: pens('20') },
  { id: 'misconception-rat-prop-multiplied-total', positive: pens('60'), negative: pens('20') },
  { id: 'misconception-frac-div-multiplied', positive: divide('3/32'), negative: divide('6') },
  { id: 'misconception-frac-div-flipped-first', positive: divide('4/24'), negative: divide('6') },
  { id: 'misconception-frac-div-flipped-both', positive: divide('32/3'), negative: divide('6') },
];
