import type { MisconceptionInput } from '@/curriculum/misconceptions';
import type { ArithmeticProblem } from '@/quality/arithmetic';

import type { SignatureCase } from './signature.fixtures';

/** P3-07: one true positive and one true negative for each add-sub misconception. */
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

// One problem per skill where every wrong idea gives a different answer.
const fact20 = on('ADD.FACT.20', 'What is 8 add 5?', '13', {
  skillCode: 'ADD.FACT.20',
  kind: 'addition',
  left: '8',
  right: '5',
});
const subFact = on('SUB.FACT.10', 'What is 7 take away 3?', '4', {
  skillCode: 'SUB.FACT.10',
  kind: 'subtraction',
  left: '7',
  right: '3',
});
const subRegroup = on('SUB.REGROUP.2D', 'What is 52 take away 18?', '34', {
  skillCode: 'SUB.REGROUP.2D',
  kind: 'subtraction',
  left: '52',
  right: '18',
});
const add3d = on('ADD.3D', 'What is 158 add 267?', '425', {
  skillCode: 'ADD.3D',
  kind: 'addition',
  left: '158',
  right: '267',
});

export const ADD_SUB_SIGNATURE_CASES: readonly SignatureCase[] = [
  {
    id: 'misconception-add-fact-20-stopped-at-ten',
    positive: fact20('10'),
    negative: fact20('13'),
  },
  {
    id: 'misconception-add-fact-20-off-by-one-short',
    positive: fact20('12'),
    negative: fact20('13'),
  },
  { id: 'misconception-add-fact-20-subtracted', positive: fact20('3'), negative: fact20('13') },
  { id: 'misconception-sub-fact-10-added', positive: subFact('10'), negative: subFact('4') },
  { id: 'misconception-sub-fact-10-counted-start', positive: subFact('5'), negative: subFact('4') },
  {
    id: 'misconception-sub-fact-10-names-the-part',
    positive: subFact('3'),
    negative: subFact('4'),
  },
  {
    id: 'misconception-sub-regroup-smaller-from-larger',
    positive: subRegroup('46'),
    negative: subRegroup('34'),
  },
  {
    id: 'misconception-sub-regroup-tens-not-reduced',
    positive: subRegroup('44'),
    negative: subRegroup('34'),
  },
  {
    id: 'misconception-sub-regroup-zero-when-smaller',
    positive: subRegroup('40'),
    negative: subRegroup('34'),
  },
  { id: 'misconception-add-3d-column-sums', positive: add3d('31115'), negative: add3d('425') },
  {
    id: 'misconception-add-3d-dropped-every-carry',
    positive: add3d('315'),
    negative: add3d('425'),
  },
  {
    id: 'misconception-add-3d-dropped-hundreds-carry',
    positive: add3d('325'),
    negative: add3d('425'),
  },
];
