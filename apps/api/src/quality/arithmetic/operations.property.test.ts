import { describe, expect, it } from 'vitest';

import { solveAddition } from '@/quality/arithmetic/solvers/addition';
import { solveFractionComparison } from '@/quality/arithmetic/solvers/comparison';
import { solveDivision } from '@/quality/arithmetic/solvers/division';
import { solveMultiplication } from '@/quality/arithmetic/solvers/multiplication';
import { solvePlaceValue } from '@/quality/arithmetic/solvers/place-value';
import { solveSubtraction } from '@/quality/arithmetic/solvers/subtraction';

describe('structured operation properties', () => {
  it('solves generated subtraction and multiplication problems exactly', () => {
    const next = createGenerator(16);
    for (let sample = 0; sample < 100; sample += 1) {
      const left = BigInt(next(0, 999));
      const right = BigInt(next(0, 999));
      const problem = { left: left.toString(), right: right.toString() };

      expect(
        solveAddition(
          { ...problem, kind: 'addition', skillCode: 'ADD.REGROUP.2D' },
          (left + right).toString(),
        ).verdict,
      ).toBe('correct');
      expect(solveSubtraction(problem, (left - right).toString()).verdict).toBe('correct');
      expect(solveMultiplication(problem, (left * right).toString()).verdict).toBe('correct');
    }
  });

  it('solves generated division as exact rational arithmetic', () => {
    const next = createGenerator(17);
    for (let sample = 0; sample < 100; sample += 1) {
      const dividend = BigInt(next(0, 999));
      const divisor = BigInt(next(1, 99));
      const problem = { left: dividend.toString(), right: divisor.toString() };

      expect(solveDivision(problem, `${dividend.toString()}/${divisor.toString()}`).verdict).toBe(
        'correct',
      );
    }
  });

  it('solves generated place-value problems', () => {
    const next = createGenerator(18);
    for (let sample = 0; sample < 100; sample += 1) {
      const value = BigInt(next(0, 9_999));
      const expected = (value / 100n) % 10n;
      expect(
        solvePlaceValue({ number: value.toString(), place: 'hundreds' }, expected.toString())
          .verdict,
      ).toBe('correct');
    }
  });

  it('compares generated fractions by exact cross-products', () => {
    const next = createGenerator(19);
    for (let sample = 0; sample < 100; sample += 1) {
      const leftNumerator = BigInt(next(0, 20));
      const rightNumerator = BigInt(next(0, 20));
      const denominator = BigInt(next(1, 20));
      const expected =
        leftNumerator < rightNumerator ? '<' : leftNumerator > rightNumerator ? '>' : '=';
      const problem = {
        skillCode: 'FRAC.COMPARE',
        kind: 'fraction-comparison',
        left: `${leftNumerator.toString()}/${denominator.toString()}`,
        right: `${rightNumerator.toString()}/${denominator.toString()}`,
      } as const;

      expect(solveFractionComparison(problem, expected).verdict).toBe('correct');
    }
  });
});

function createGenerator(seed: number): (minimum: number, maximum: number) => number {
  let state = seed;
  return (minimum, maximum) => {
    state = (state * 48_271) % 2_147_483_647;
    return minimum + (state % (maximum - minimum + 1));
  };
}
