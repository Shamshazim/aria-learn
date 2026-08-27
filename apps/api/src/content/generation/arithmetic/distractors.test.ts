import { describe, expect, it } from 'vitest';

import { buildDistractors } from '@/content/generation/arithmetic';
import type { ArithmeticProblem } from '@/quality/arithmetic';

const REGROUP: ArithmeticProblem = {
  skillCode: 'ADD.REGROUP.2D',
  kind: 'addition',
  left: '48',
  right: '37',
};

describe('distractors', () => {
  it('offers the wrong ideas we know about, named', () => {
    const distractors = buildDistractors({ problem: REGROUP, answer: '85', count: 2 });
    expect(distractors).toEqual([
      { text: '715', misconceptionId: 'misconception-add-regroup-no-carry' },
      { text: '75', misconceptionId: 'misconception-add-regroup-dropped-carry' },
    ]);
  });

  it('never offers a second correct answer', () => {
    const equality: ArithmeticProblem = {
      skillCode: 'FRAC.EQUAL',
      kind: 'fraction-equality',
      left: '1/2',
      right: '2/4',
    };
    const distractors = buildDistractors({ problem: equality, answer: 'equal', count: 2 });
    expect(distractors.map((distractor) => distractor.text)).toEqual(['not equal']);
  });

  it('falls back to near misses when the signatures run out, and says so', () => {
    const facts: ArithmeticProblem = {
      skillCode: 'ADD.FACT.10',
      kind: 'addition',
      left: '5',
      right: '5',
    };
    const distractors = buildDistractors({ problem: facts, answer: '10', count: 4 });
    expect(distractors.length).toBe(4);
    expect(distractors.some((distractor) => distractor.misconceptionId === null)).toBe(true);
  });
});
