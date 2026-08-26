import { describe, expect, it } from 'vitest';

import { acceptWordProblem } from '@/content/generation/arithmetic';
import type { ArithmeticProblem } from '@/quality/arithmetic';

const REGROUP: ArithmeticProblem = {
  skillCode: 'ADD.REGROUP.2D',
  kind: 'addition',
  left: '48',
  right: '37',
};

describe('word-problem wrapping', () => {
  it('accepts a story that keeps every number', () => {
    expect(
      acceptWordProblem(REGROUP, 'Maya had 48 marbles and won 37 more. How many now?'),
    ).toEqual({ accepted: true, prompt: 'Maya had 48 marbles and won 37 more. How many now?' });
  });

  it('rejects a story that changes a number', () => {
    // The failure this exists for: the key is still 85 and the child is reading 47.
    expect(acceptWordProblem(REGROUP, 'Maya had 47 marbles and won 37 more.')).toEqual({
      accepted: false,
      reason: 'numbers-changed',
    });
  });

  it('rejects a story that drops a number', () => {
    expect(acceptWordProblem(REGROUP, 'Maya had 48 marbles and won some more.')).toEqual({
      accepted: false,
      reason: 'numbers-missing',
    });
  });

  it('rejects a story that adds a number of its own', () => {
    expect(acceptWordProblem(REGROUP, 'Maya had 48 marbles, won 37, and 2 rolled away.')).toEqual({
      accepted: false,
      reason: 'numbers-changed',
    });
  });

  it('rejects an empty wrapper', () => {
    expect(acceptWordProblem(REGROUP, '   ')).toEqual({ accepted: false, reason: 'empty' });
  });

  it('keeps the digits of a fraction rather than its words', () => {
    const fractions: ArithmeticProblem = {
      skillCode: 'FRAC.COMPARE',
      kind: 'fraction-comparison',
      left: '5/8',
      right: '3/8',
    };
    expect(
      acceptWordProblem(fractions, 'Sam ate 5/8 and Lee ate 3/8. Who ate more?').accepted,
    ).toBe(true);
    expect(
      acceptWordProblem(fractions, 'Sam ate five eighths and Lee ate three eighths.').accepted,
    ).toBe(false);
  });
});
