import type { MisconceptionInput } from '@/curriculum/misconceptions';
import type { ArithmeticProblem } from '@/quality/arithmetic';

import type { SignatureCase } from './signature.fixtures';

/** P3-07: one true positive and one true negative for each mul-div misconception. */
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

const fact = on('MUL.FACT.10', 'What is 7 times 6?', '42', {
  skillCode: 'MUL.FACT.10',
  kind: 'multiplication',
  left: '7',
  right: '6',
});
const share = on('DIV.FACT.10', 'What is 24 divided by 6?', '4', {
  skillCode: 'DIV.FACT.10',
  kind: 'division',
  left: '24',
  right: '6',
});
const times = on('MUL.2D1D', 'What is 47 times 6?', '282', {
  skillCode: 'MUL.2D1D',
  kind: 'multiplication',
  left: '47',
  right: '6',
});
const long = on('DIV.LONG', 'What is 157 divided by 4?', '39 r 1', {
  skillCode: 'DIV.LONG',
  kind: 'division',
  left: '157',
  right: '4',
});
// A quotient with a zero in the middle, for the missing-zero idea.
const zero = on('DIV.LONG', 'What is 412 divided by 4?', '103', {
  skillCode: 'DIV.LONG',
  kind: 'division',
  left: '412',
  right: '4',
});

export const MUL_DIV_SIGNATURE_CASES: readonly SignatureCase[] = [
  { id: 'misconception-mul-fact-10-added', positive: fact('13'), negative: fact('42') },
  { id: 'misconception-mul-fact-10-one-group-short', positive: fact('36'), negative: fact('42') },
  { id: 'misconception-mul-fact-10-one-group-extra', positive: fact('49'), negative: fact('42') },
  { id: 'misconception-div-fact-10-multiplied', positive: share('144'), negative: share('4') },
  { id: 'misconception-div-fact-10-subtracted', positive: share('18'), negative: share('4') },
  { id: 'misconception-div-fact-10-one-group-short', positive: share('3'), negative: share('4') },
  {
    id: 'misconception-mul-2d1d-products-side-by-side',
    positive: times('2442'),
    negative: times('282'),
  },
  { id: 'misconception-mul-2d1d-dropped-carry', positive: times('242'), negative: times('282') },
  { id: 'misconception-mul-2d1d-tens-as-ones', positive: times('66'), negative: times('282') },
  {
    id: 'misconception-div-long-remainder-dropped',
    positive: long('39'),
    negative: long('39 r 1'),
  },
  {
    id: 'misconception-div-long-remainder-as-decimal',
    positive: long('39.1'),
    negative: long('39 r 1'),
  },
  { id: 'misconception-div-long-missing-zero', positive: zero('13'), negative: zero('103') },
];
