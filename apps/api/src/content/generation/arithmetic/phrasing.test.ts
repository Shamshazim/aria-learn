import { describe, expect, it } from 'vitest';

import { phraseItem } from '@/content/generation/arithmetic';
import type { ArithmeticProblem } from '@/quality/arithmetic';

const SMALL: ArithmeticProblem = {
  skillCode: 'ADD.FACT.10',
  kind: 'addition',
  left: '7',
  right: '3',
};
const LARGE: ArithmeticProblem = {
  skillCode: 'ADD.REGROUP.2D',
  kind: 'addition',
  left: '48',
  right: '37',
};

describe('phrasing an item for a band', () => {
  it('spells small numbers out for the early band and leaves large ones as digits', () => {
    expect(phraseItem(SMALL, 'early')).toBe('What is seven add three?');
    // Spelling out forty-eight makes the sentence harder to read, not easier.
    expect(phraseItem(LARGE, 'early')).toBe('What is 48 add 37?');
  });

  it('uses notation only for the senior band', () => {
    expect(phraseItem(LARGE, 'middle')).toBe('What is 48 add 37?');
    expect(phraseItem(LARGE, 'senior')).toBe('48 + 37 = ?');
  });

  it('never changes a number it was handed', () => {
    for (const band of ['early', 'middle', 'senior'] as const) {
      for (const problem of [SMALL, LARGE]) {
        const digits = [...phraseItem(problem, band).matchAll(/\d+/gu)].map((match) => match[0]);
        expect(digits.every((digit) => [problem.left, problem.right].includes(digit))).toBe(true);
      }
    }
  });

  it('asks the fraction questions in the words each band would hear them in', () => {
    const compare: ArithmeticProblem = {
      skillCode: 'FRAC.COMPARE',
      kind: 'fraction-comparison',
      left: '5/8',
      right: '3/8',
    };
    expect(phraseItem(compare, 'early')).toBe('Which is more, 5/8 or 3/8?');
    expect(phraseItem(compare, 'senior')).toBe('Compare 5/8 and 3/8.');
  });
});
