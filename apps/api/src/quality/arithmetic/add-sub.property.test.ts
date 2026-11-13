import { describe, expect, it } from 'vitest';

import { SKILL_PARAMS } from '@/content/generation/arithmetic/params';
import { predictArithmeticError } from '@/curriculum/misconceptions/derived-arithmetic';
import type { ArithmeticRule } from '@/curriculum/misconceptions/signature.types';
import { checkArithmetic } from '@/quality/arithmetic';

/** A deterministic generator, so a failure names a seed that reproduces it. */
function lcg(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

const RUNS = 10_000;

const ADD_SUB_RULES: readonly ArithmeticRule[] = [
  'column-sums-concatenated',
  'dropped-every-carry',
  'dropped-hundreds-carry',
  'stopped-at-ten',
  'added-instead',
  'counted-back-including-start',
  'answered-the-part',
  'smaller-from-larger',
  'borrowed-without-reducing-tens',
  'zero-when-smaller',
  'names-an-operand',
  'subtracted-instead',
];

describe('add-sub checkers against BigInt (P3-07)', () => {
  it('three-digit addition: 10,000 seeded sums', () => {
    const random = lcg(41);
    for (let run = 0; run < RUNS; run += 1) {
      const left = BigInt(Math.floor(random() * 900) + 100);
      const right = BigInt(Math.floor(random() * 900) + 100);
      const problem = {
        skillCode: 'ADD.3D',
        kind: 'addition',
        left: left.toString(),
        right: right.toString(),
      } as const;
      expect(checkArithmetic(problem, (left + right).toString()).verdict).toBe('correct');
      expect(checkArithmetic(problem, (left + right + 1n).toString()).verdict).toBe('incorrect');
    }
  });

  it('subtraction: 10,000 seeded differences', () => {
    const random = lcg(53);
    for (let run = 0; run < RUNS; run += 1) {
      const right = BigInt(Math.floor(random() * 90) + 10);
      const left = right + BigInt(Math.floor(random() * 900));
      const problem = {
        skillCode: 'SUB.REGROUP.2D',
        kind: 'subtraction',
        left: left.toString(),
        right: right.toString(),
      } as const;
      expect(checkArithmetic(problem, (left - right).toString()).verdict).toBe('correct');
      expect(checkArithmetic(problem, (left - right - 1n).toString()).verdict).toBe('incorrect');
    }
  });
});

describe('add-sub wrong ideas (P3-07)', () => {
  it.each(['ADD.FACT.20', 'ADD.3D', 'SUB.FACT.10', 'SUB.REGROUP.2D'] as const)(
    'never predict the right answer anywhere in the %s space',
    (skillCode) => {
      const params = SKILL_PARAMS[skillCode];
      for (let index = 0; index < params.size; index += 1) {
        const item = params.at(index);
        if (item === null) throw new Error(`${skillCode} has a gap at ${String(index)}`);
        for (const rule of ADD_SUB_RULES) {
          expect(
            predictArithmeticError(rule, item.problem),
            `${skillCode} ${String(index)} ${rule}`,
          ).not.toContain(item.answer);
        }
      }
    },
  );

  it('the regrouping rules fire on every item that needs a trade', () => {
    for (const skillCode of ['SUB.REGROUP.2D', 'ADD.3D'] as const) {
      const params = SKILL_PARAMS[skillCode];
      const rule: ArithmeticRule =
        skillCode === 'ADD.3D' ? 'dropped-every-carry' : 'smaller-from-larger';
      for (let index = 0; index < params.size; index += 1) {
        const item = params.at(index);
        expect(
          item === null ? [] : predictArithmeticError(rule, item.problem),
          `${skillCode} ${String(index)}`,
        ).toHaveLength(1);
      }
    }
  });
});
