import { describe, expect, it } from 'vitest';

import { matchMisconception } from '@/curriculum/misconception.matcher';

describe('authored misconception signatures', () => {
  it.each([
    [
      {
        skillCode: 'FRAC.COMPARE',
        question: 'Which is bigger?',
        expectedAnswer: '1/3',
        learnerAnswer: '1/8',
      },
      'misconception-frac-compare-denominator',
    ],
    [
      {
        skillCode: 'PH.SILENT_E',
        question: 'Read cape',
        expectedAnswer: 'cape',
        learnerAnswer: 'cap',
      },
      'misconception-ph-silent-e-short-vowel',
    ],
    [
      {
        skillCode: 'ADD.REGROUP.2D',
        question: 'What is 38 + 27?',
        expectedAnswer: '65',
        learnerAnswer: '515',
      },
      'misconception-add-regroup-no-carry',
    ],
  ] as const)('matches a known wrong idea', (input, id) => {
    expect(matchMisconception(input)).toBe(id);
  });

  it('does not label an unrelated wrong answer', () => {
    expect(
      matchMisconception({
        skillCode: 'ADD.REGROUP.2D',
        question: 'What is 38 + 27?',
        expectedAnswer: '65',
        learnerAnswer: '64',
      }),
    ).toBeNull();
  });
});
