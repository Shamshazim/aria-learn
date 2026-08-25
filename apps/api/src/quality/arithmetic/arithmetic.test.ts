import { describe, expect, it } from 'vitest';

import { checkArithmetic, isArithmeticPass } from '@/quality/arithmetic';
import { ARITHMETIC_CASES } from '@/quality/arithmetic/__fixtures__/cases.data';

describe('checkArithmetic', () => {
  it('independently accepts the right addition answer and rejects a wrong one', () => {
    const problem = {
      skillCode: 'ADD.FACT.10',
      kind: 'addition',
      left: '7',
      right: '3',
    } as const;

    expect(checkArithmetic(problem, '10')).toMatchObject({ verdict: 'correct', expected: '10' });
    expect(checkArithmetic(problem, '11')).toMatchObject({ verdict: 'incorrect', expected: '10' });
  });

  it.each(ARITHMETIC_CASES)('$name returns $verdict', ({ problem, candidate, verdict }) => {
    expect(checkArithmetic(problem, candidate).verdict).toBe(verdict);
  });

  it('treats undecidable as a gate failure', () => {
    const result = checkArithmetic(
      { skillCode: 'ADD.FACT.10', kind: 'addition', left: 'a word problem', right: '3' },
      '5',
    );

    expect(result.verdict).toBe('undecidable');
    expect(isArithmeticPass(result)).toBe(false);
  });
});
