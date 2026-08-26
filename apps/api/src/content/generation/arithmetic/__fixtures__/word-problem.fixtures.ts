import type { Band } from '@aria/shared';

import type { ArithmeticProblem } from '@/quality/arithmetic';

export const WORD_PROBLEM_PROBLEM: ArithmeticProblem = {
  skillCode: 'ADD.REGROUP.2D',
  kind: 'addition',
  left: '48',
  right: '37',
};

const FRACTIONS: ArithmeticProblem = {
  skillCode: 'FRAC.COMPARE',
  kind: 'fraction-comparison',
  left: '5/8',
  right: '3/8',
};

export type WordProblemCase = Readonly<{
  name: string;
  wrapper: string;
  band: Band;
  accepted: boolean;
  reason?: 'numbers-changed' | 'numbers-missing' | 'empty' | 'gate-failed';
  problem?: ArithmeticProblem;
}>;

/** The wrapper failures worth naming, and the one shape that is allowed through. */
export const WORD_PROBLEM_CASES: readonly WordProblemCase[] = [
  {
    name: 'accepts a story that keeps every number',
    wrapper: 'Maya had 48 marbles. She won 37 more. How many now?',
    band: 'middle',
    accepted: true,
  },
  {
    name: 'rejects a story that changes a number',
    wrapper: 'Maya had 47 marbles. She won 37 more.',
    band: 'middle',
    accepted: false,
    reason: 'numbers-changed',
  },
  {
    name: 'rejects a story that drops a number',
    wrapper: 'Maya had 48 marbles. She won some more.',
    band: 'middle',
    accepted: false,
    reason: 'numbers-missing',
  },
  {
    name: 'rejects a story that adds a number of its own',
    wrapper: 'Maya had 48 marbles. She won 37. Then 2 rolled away.',
    band: 'middle',
    accepted: false,
    reason: 'numbers-changed',
  },
  {
    name: 'rejects an empty wrapper',
    wrapper: '   ',
    band: 'middle',
    accepted: false,
    reason: 'empty',
  },
  {
    name: 'keeps the digits of a fraction rather than its words',
    wrapper: 'Sam ate 5/8 of it. Lee ate 3/8. Who ate more?',
    band: 'middle',
    accepted: true,
    problem: FRACTIONS,
  },
  {
    name: 'rejects a fraction story that spells the numbers out',
    wrapper: 'Sam ate five eighths and Lee ate three eighths.',
    band: 'middle',
    accepted: false,
    reason: 'numbers-missing',
    problem: FRACTIONS,
  },
];
