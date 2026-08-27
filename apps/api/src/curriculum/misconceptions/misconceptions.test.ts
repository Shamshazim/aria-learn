import { describe, expect, it } from 'vitest';

import { matchMisconception, matchMisconceptions } from '@/curriculum/misconception.matcher';
import { AUTHORED_MISCONCEPTIONS } from '@/curriculum/misconceptions';
import { SIGNATURE_CASES } from '@/curriculum/misconceptions/__fixtures__/signature.fixtures';

describe('authored misconceptions', () => {
  it('covers every skill three times over', () => {
    const bySkill = new Map<string, number>();
    for (const misconception of AUTHORED_MISCONCEPTIONS) {
      bySkill.set(misconception.skillCode, (bySkill.get(misconception.skillCode) ?? 0) + 1);
    }
    for (const [skillCode, count] of bySkill) expect(count, skillCode).toBeGreaterThanOrEqual(3);
  });

  it('has unique ids', () => {
    const ids = new Set(AUTHORED_MISCONCEPTIONS.map((misconception) => misconception.id));
    expect(ids.size).toBe(AUTHORED_MISCONCEPTIONS.length);
  });

  it('has a true positive and a true negative for every authored id', () => {
    const covered = new Set(SIGNATURE_CASES.map((testCase) => testCase.id));
    const missing = AUTHORED_MISCONCEPTIONS.filter(
      (misconception) => !covered.has(misconception.id),
    ).map((misconception) => misconception.id);
    expect(missing).toEqual([]);
  });

  it.each(SIGNATURE_CASES.map((testCase) => [testCase.id, testCase] as const))(
    'recognises %s and only when it is there',
    (id, testCase) => {
      expect(matchMisconceptions(testCase.positive)).toContain(id);
      expect(matchMisconceptions(testCase.negative)).not.toContain(id);
    },
  );
});

describe('resolving between candidates', () => {
  const ambiguous = {
    skillCode: 'FRAC.COMPARE',
    question: 'Compare 1/3 and 1/8.',
    expectedAnswer: '>',
    learnerAnswer: '<',
    problem: {
      skillCode: 'FRAC.COMPARE',
      kind: 'fraction-comparison',
      left: '1/3',
      right: '1/8',
    },
  } as const;

  it('prefers the wrong idea this child has already shown', () => {
    // Both the denominator and the reversal signatures fit `<` here, and authored order would
    // pick the first. A misconception seen before is stronger evidence than either.
    expect(matchMisconceptions(ambiguous).length).toBeGreaterThan(1);
    expect(matchMisconception(ambiguous, ['misconception-frac-compare-reversed'])).toBe(
      'misconception-frac-compare-reversed',
    );
  });

  it('falls back to authored order with nothing known about the child', () => {
    expect(matchMisconception(ambiguous)).toBe('misconception-frac-compare-denominator');
  });

  it('reports nothing for a correct answer', () => {
    expect(matchMisconception({ ...ambiguous, learnerAnswer: '>' })).toBeNull();
  });
});
