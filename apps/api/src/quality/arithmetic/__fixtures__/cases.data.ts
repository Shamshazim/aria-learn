import type { ArithmeticProblem, CheckResult } from '@/quality/arithmetic';

export type ArithmeticCase = Readonly<{
  name: string;
  problem: ArithmeticProblem;
  candidate: string;
  verdict: CheckResult['verdict'];
}>;

/** Every inventory skill has authoritative correct, incorrect and refusal coverage. */
export const ARITHMETIC_CASES: readonly ArithmeticCase[] = [
  {
    name: 'count to twenty',
    problem: { skillCode: 'NUM.CNT.20', kind: 'sequence', values: ['17', '18', '19'], step: '1' },
    candidate: '20.',
    verdict: 'correct',
  },
  {
    name: 'skip count by five',
    problem: { skillCode: 'NUM.CNT.SKIP5', kind: 'sequence', values: ['5', '10', '15'], step: '5' },
    candidate: '25',
    verdict: 'incorrect',
  },
  {
    name: 'addition fact',
    problem: { skillCode: 'ADD.FACT.10', kind: 'addition', left: '7', right: '3' },
    candidate: '10',
    verdict: 'correct',
  },
  {
    name: 'two digit regrouping',
    problem: { skillCode: 'ADD.REGROUP.2D', kind: 'addition', left: '48', right: '37' },
    candidate: '75',
    verdict: 'incorrect',
  },
  {
    name: 'equivalent fractions',
    problem: { skillCode: 'FRAC.EQUAL', kind: 'fraction-equality', left: '1/2', right: '2/4' },
    candidate: 'yes',
    verdict: 'correct',
  },
  {
    name: 'same denominator comparison',
    problem: { skillCode: 'FRAC.COMPARE', kind: 'fraction-comparison', left: '3/8', right: '5/8' },
    candidate: '>',
    verdict: 'incorrect',
  },
  {
    name: 'ambiguous sequence from legacy refusal class',
    problem: { skillCode: 'NUM.CNT.SKIP5', kind: 'sequence', values: ['5', '11'], step: '5' },
    candidate: '16',
    verdict: 'undecidable',
  },
  {
    name: 'free-form arithmetic is deliberately refused',
    problem: { skillCode: 'ADD.FACT.10', kind: 'addition', left: 'two apples', right: '3' },
    candidate: '5',
    verdict: 'undecidable',
  },
];
