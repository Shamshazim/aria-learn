import type { MisconceptionInput } from '@/curriculum/misconceptions';
import type { ArithmeticProblem } from '@/quality/arithmetic';

import type { SignatureCase } from './signature.fixtures';

/** P3-07: one true positive and one true negative for each number-sense misconception. */
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

const tens = on('NUM.PV.TENS', 'In 47, which digit is in the tens place?', '4', {
  skillCode: 'NUM.PV.TENS',
  kind: 'place-value',
  number: '47',
  place: 'tens',
});
const hundreds = on('NUM.PV.HUNDREDS', 'In 352, which digit is in the hundreds place?', '3', {
  skillCode: 'NUM.PV.HUNDREDS',
  kind: 'place-value',
  number: '352',
  place: 'hundreds',
});
const compareMislead = on('NUM.CMP.100', 'Compare 29 and 31.', '<', {
  skillCode: 'NUM.CMP.100',
  kind: 'whole-comparison',
  left: '29',
  right: '31',
});
const compareSameTens = on('NUM.CMP.100', 'Compare 42 and 47.', '<', {
  skillCode: 'NUM.CMP.100',
  kind: 'whole-comparison',
  left: '42',
  right: '47',
});
const roundUp = on('NUM.RND.10', 'Round 47 to the nearest ten.', '50', {
  skillCode: 'NUM.RND.10',
  kind: 'rounding',
  number: '47',
  to: '10',
});
const roundDown = on('NUM.RND.10', 'Round 342 to the nearest ten.', '340', {
  skillCode: 'NUM.RND.10',
  kind: 'rounding',
  number: '342',
  to: '10',
});

export const NUMBER_SENSE_SIGNATURE_CASES: readonly SignatureCase[] = [
  { id: 'misconception-num-pv-tens-other-place', positive: tens('7'), negative: tens('4') },
  { id: 'misconception-num-pv-tens-amount', positive: tens('40'), negative: tens('4') },
  { id: 'misconception-num-pv-tens-whole', positive: tens('47'), negative: tens('4') },
  {
    id: 'misconception-num-pv-hundreds-next-place',
    positive: hundreds('5'),
    negative: hundreds('3'),
  },
  {
    id: 'misconception-num-pv-hundreds-amount',
    positive: hundreds('300'),
    negative: hundreds('3'),
  },
  { id: 'misconception-num-pv-hundreds-whole', positive: hundreds('352'), negative: hundreds('3') },
  {
    id: 'misconception-num-cmp-100-reversed',
    positive: compareMislead('>'),
    negative: compareMislead('<'),
  },
  {
    id: 'misconception-num-cmp-100-ones-first',
    positive: compareMislead('>'),
    negative: compareMislead('<'),
  },
  {
    id: 'misconception-num-cmp-100-same-tens',
    positive: compareSameTens('='),
    negative: compareSameTens('<'),
  },
  { id: 'misconception-num-rnd-10-always-down', positive: roundUp('40'), negative: roundUp('50') },
  {
    id: 'misconception-num-rnd-10-always-up',
    positive: roundDown('350'),
    negative: roundDown('340'),
  },
  {
    id: 'misconception-num-rnd-10-hundred',
    positive: roundDown('300'),
    negative: roundDown('340'),
  },
];
