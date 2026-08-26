import { describe, expect, it } from 'vitest';

import { acceptWordProblem } from '@/content/generation/arithmetic';
import {
  WORD_PROBLEM_CASES,
  WORD_PROBLEM_PROBLEM,
} from '@/content/generation/arithmetic/__fixtures__/word-problem.fixtures';
import { outputSafety } from '@/content/output-safety';
import { createQualityGate } from '@/quality';

const GATE = createQualityGate(outputSafety);

describe('word-problem wrapping', () => {
  it.each(WORD_PROBLEM_CASES.map((testCase) => [testCase.name, testCase] as const))(
    '%s',
    (_name, testCase) => {
      const verdict = acceptWordProblem({
        problem: testCase.problem ?? WORD_PROBLEM_PROBLEM,
        wrapper: testCase.wrapper,
        band: testCase.band,
        gate: GATE,
      });

      expect(verdict.accepted).toBe(testCase.accepted);
      if (!verdict.accepted && testCase.reason !== undefined) {
        expect(verdict.reason).toBe(testCase.reason);
      }
    },
  );

  it('names the gate check that refused, so the retry has something to go on', () => {
    const verdict = acceptWordProblem({
      problem: WORD_PROBLEM_PROBLEM,
      // Numbers intact, but nobody would read this sentence to a six-year-old.
      wrapper:
        'Maya, having previously accumulated 48 marbles through assorted playground negotiations, subsequently acquired an additional 37 marbles, whereupon she endeavoured to ascertain the aggregate.',
      band: 'early',
      gate: GATE,
    });

    expect(verdict.accepted).toBe(false);
    expect(verdict.accepted ? [] : verdict.codes).not.toEqual([]);
  });
});
