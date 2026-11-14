import type { MisconceptionInput } from '@/curriculum/misconceptions';
import type { ArithmeticProblem } from '@/quality/arithmetic';

import type { SignatureCase } from './signature.fixtures';

/** P3-07: one true positive and one true negative for each measurement and data idea. */
function on(skillCode: string, expectedAnswer: string, problem: ArithmeticProblem) {
  return (learnerAnswer: string): MisconceptionInput => ({
    skillCode,
    question: null,
    expectedAnswer,
    learnerAnswer,
    problem,
  });
}

const time = on('MEAS.TIME', '3:15', {
  skillCode: 'MEAS.TIME',
  kind: 'elapsed-time',
  start: '2:45',
  minutes: '30',
});
const change = on('MEAS.MONEY', '$1.55', {
  skillCode: 'MEAS.MONEY',
  kind: 'money-change',
  paid: '5.00',
  cost: '3.45',
});
const area = on('MEAS.AREA', '24', {
  skillCode: 'MEAS.AREA',
  kind: 'rectangle',
  width: '6',
  height: '4',
  measure: 'area',
  unit: 'cm',
});
const convert = on('MEAS.CONV', '300', {
  skillCode: 'MEAS.CONV',
  kind: 'unit-conversion',
  amount: '3',
  from: 'm',
  to: 'cm',
});
const mean = on('DATA.MEAN', '5', {
  skillCode: 'DATA.MEAN',
  kind: 'statistic',
  values: ['2', '3', '10'],
  measure: 'mean',
});
const median = on('DATA.MEAN', '5', {
  skillCode: 'DATA.MEAN',
  kind: 'statistic',
  values: ['2', '9', '1', '7', '5'],
  measure: 'median',
});

export const MEASURE_SIGNATURE_CASES: readonly SignatureCase[] = [
  {
    id: 'misconception-meas-time-minutes-as-hundreds',
    positive: time('2:75'),
    negative: time('3:15'),
  },
  {
    id: 'misconception-meas-time-hour-not-carried',
    positive: time('2:15'),
    negative: time('3:15'),
  },
  {
    id: 'misconception-meas-time-minutes-replaced',
    positive: time('2:30'),
    negative: time('3:15'),
  },
  {
    id: 'misconception-meas-money-smaller-from-larger',
    positive: change('$2.45'),
    negative: change('$1.55'),
  },
  { id: 'misconception-meas-money-added', positive: change('$8.45'), negative: change('$1.55') },
  {
    id: 'misconception-meas-money-dropped-point',
    positive: change('155'),
    negative: change('$1.55'),
  },
  { id: 'misconception-meas-area-swapped', positive: area('20'), negative: area('24') },
  { id: 'misconception-meas-area-added-two-sides', positive: area('10'), negative: area('24') },
  { id: 'misconception-meas-area-one-side-squared', positive: area('36'), negative: area('24') },
  { id: 'misconception-meas-conv-divided', positive: convert('0.03'), negative: convert('300') },
  { id: 'misconception-meas-conv-used-ten', positive: convert('30'), negative: convert('300') },
  {
    id: 'misconception-meas-conv-wrong-factor',
    positive: convert('3000'),
    negative: convert('300'),
  },
  { id: 'misconception-data-mean-median-unsorted', positive: median('1'), negative: median('5') },
  { id: 'misconception-data-mean-swapped', positive: mean('3'), negative: mean('5') },
  { id: 'misconception-data-mean-sum-not-divided', positive: mean('15'), negative: mean('5') },
];
