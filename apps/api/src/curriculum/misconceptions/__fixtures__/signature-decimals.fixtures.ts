import type { MisconceptionInput } from '@/curriculum/misconceptions';
import type { ArithmeticProblem } from '@/quality/arithmetic';

import type { SignatureCase } from './signature.fixtures';

/** P3-07: one true positive and one true negative for each decimal and percent misconception. */
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

const place = on('DEC.PV', 'In 3.47, which digit is in the tenths place?', '4', {
  skillCode: 'DEC.PV',
  kind: 'decimal-place',
  number: '3.47',
  place: 'tenths',
});
const compare = (left: string, right: string, expected: string) =>
  on('DEC.CMP', `Compare ${left} and ${right}.`, expected, {
    skillCode: 'DEC.CMP',
    kind: 'decimal-comparison',
    left,
    right,
  });
// Shorter but bigger; shorter and smaller; the same length, for the sign alone.
const shortBig = compare('0.3', '0.25', '>');
const shortSmall = compare('0.4', '0.75', '<');
const sameLength = compare('0.62', '0.58', '>');
const add = on('DEC.ADD', 'What is 3.4 add 1.25?', '4.65', {
  skillCode: 'DEC.ADD',
  kind: 'decimal-operation',
  operation: 'add',
  left: '3.4',
  right: '1.25',
});
const percent = on('PCT.OF', 'What is 25% of 80?', '20', {
  skillCode: 'PCT.OF',
  kind: 'percent-of',
  percent: '25',
  whole: '80',
});

export const DECIMAL_SIGNATURE_CASES: readonly SignatureCase[] = [
  { id: 'misconception-dec-pv-neighbour-digit', positive: place('7'), negative: place('4') },
  { id: 'misconception-dec-pv-place-amount', positive: place('0.4'), negative: place('4') },
  { id: 'misconception-dec-pv-ones-digit', positive: place('3'), negative: place('4') },
  {
    id: 'misconception-dec-cmp-longer-is-larger',
    positive: shortBig('<'),
    negative: shortBig('>'),
  },
  {
    id: 'misconception-dec-cmp-shorter-is-larger',
    positive: shortSmall('>'),
    negative: shortSmall('<'),
  },
  { id: 'misconception-dec-cmp-reversed', positive: sameLength('<'), negative: sameLength('>') },
  { id: 'misconception-dec-add-right-aligned', positive: add('1.59'), negative: add('4.65') },
  { id: 'misconception-dec-add-dropped-point', positive: add('465'), negative: add('4.65') },
  { id: 'misconception-dec-add-parts-as-wholes', positive: add('4.29'), negative: add('4.65') },
  { id: 'misconception-pct-of-no-hundred', positive: percent('2000'), negative: percent('20') },
  { id: 'misconception-pct-of-divided', positive: percent('3.2'), negative: percent('20') },
  { id: 'misconception-pct-of-subtracted', positive: percent('55'), negative: percent('20') },
];
