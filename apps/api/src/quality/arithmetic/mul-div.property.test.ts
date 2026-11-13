import { describe, expect, it } from 'vitest';

import { SKILL_PARAMS } from '@/content/generation/arithmetic/params';
import { predictArithmeticError } from '@/curriculum/misconceptions/derived-arithmetic';
import type { ArithmeticRule } from '@/curriculum/misconceptions/signature.types';
import { checkArithmetic, procedureSteps } from '@/quality/arithmetic';
import { parseQuotientWithRemainder } from '@/quality/arithmetic/remainder';

function lcg(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

const RUNS = 10_000;

const MUL_DIV_RULES: readonly ArithmeticRule[] = [
  'added-instead',
  'subtracted-instead',
  'one-group-short',
  'one-group-extra',
  'column-products-concatenated',
  'dropped-product-carry',
  'tens-digit-as-ones',
  'multiplied-instead',
  'remainder-dropped',
  'remainder-as-decimal',
  'missing-zero-in-quotient',
];

describe('mul-div checkers against BigInt (P3-07)', () => {
  it('multiplication: 10,000 seeded products', () => {
    const random = lcg(61);
    for (let run = 0; run < RUNS; run += 1) {
      const left = BigInt(Math.floor(random() * 90) + 10);
      const right = BigInt(Math.floor(random() * 9) + 1);
      const problem = {
        skillCode: 'MUL.2D1D',
        kind: 'multiplication',
        left: left.toString(),
        right: right.toString(),
      } as const;
      expect(checkArithmetic(problem, (left * right).toString()).verdict).toBe('correct');
      expect(checkArithmetic(problem, (left * right + 1n).toString()).verdict).toBe('incorrect');
    }
  });

  it('long division: 10,000 seeded quotients and remainders, and the steps rebuild them', () => {
    const random = lcg(67);
    for (let run = 0; run < RUNS; run += 1) {
      const dividend = BigInt(Math.floor(random() * 9_900) + 100);
      const divisor = BigInt(Math.floor(random() * 8) + 2);
      const [quotient, remainder] = [dividend / divisor, dividend % divisor];
      const problem = {
        skillCode: 'DIV.LONG',
        kind: 'division',
        left: dividend.toString(),
        right: divisor.toString(),
      } as const;
      const key =
        remainder === 0n ? quotient.toString() : `${quotient.toString()} r ${remainder.toString()}`;
      expect(checkArithmetic(problem, key).verdict, key).toBe('correct');
      if (remainder > 0n)
        expect(checkArithmetic(problem, quotient.toString()).verdict).toBe('incorrect');
      // Steps alternate "how many groups" and "what is left": the groups are the quotient's
      // digits and the last thing left is the remainder.
      const steps = procedureSteps(problem);
      const digits = steps.filter((_step, index) => index % 2 === 0).map((step) => step.answer);
      expect(BigInt(digits.join(''))).toBe(quotient);
      expect(steps.at(-1)?.answer).toBe(remainder.toString());
    }
  });
});

describe('remainder answers (P3-07 edge cases)', () => {
  it.each(['39 r 1', '39 R1', '39r1', '39 rem 1', '39 remainder 1', 'thirty nine r one'])(
    'reads %j as 39 remainder 1',
    (text) => {
      expect(parseQuotientWithRemainder(text)).toEqual({ quotient: 39n, remainder: 1n });
    },
  );

  it('reads a plain number as no remainder, and refuses a remainder as big as the divisor', () => {
    expect(parseQuotientWithRemainder('40')).toEqual({ quotient: 40n, remainder: 0n });
    const problem = { skillCode: 'DIV.LONG', kind: 'division', left: '160', right: '4' } as const;
    expect(checkArithmetic(problem, '39 r 4').verdict).toBe('incorrect');
    expect(checkArithmetic(problem, '40').verdict).toBe('correct');
  });
});

describe('procedure steps (P3-07)', () => {
  it('works 157 ÷ 4 as written on paper', () => {
    const steps = procedureSteps({
      skillCode: 'DIV.LONG',
      kind: 'division',
      left: '157',
      right: '4',
    });
    expect(steps.map((step) => step.answer)).toEqual(['3', '3', '9', '1']);
    expect(steps[2]?.prompt).toBe('Bring down the 7. How many 4s go into 37?');
  });

  it('writes the zero in 412 ÷ 4', () => {
    const steps = procedureSteps({
      skillCode: 'DIV.LONG',
      kind: 'division',
      left: '412',
      right: '4',
    });
    expect(steps.filter((_step, index) => index % 2 === 0).map((step) => step.answer)).toEqual([
      '1',
      '0',
      '3',
    ]);
  });

  it('never puts the final answer in a prompt, for any procedure item', () => {
    for (const skillCode of [
      'ADD.REGROUP.2D',
      'ADD.3D',
      'SUB.REGROUP.2D',
      'MUL.2D1D',
      'DIV.LONG',
    ] as const) {
      const params = SKILL_PARAMS[skillCode];
      for (let index = 0; index < params.size; index += 1) {
        const item = params.at(index);
        if (item === null) continue;
        const steps = procedureSteps(item.problem);
        expect(steps.length, `${skillCode} ${String(index)}`).toBeGreaterThanOrEqual(2);
        for (const step of steps) {
          expect(step.prompt.split(/[^\d]+/u), `${skillCode} ${String(index)}`).not.toContain(
            item.answer,
          );
        }
      }
    }
  });

  it('gives facts and number sense no steps', () => {
    expect(
      procedureSteps({ skillCode: 'MUL.FACT.10', kind: 'multiplication', left: '7', right: '6' }),
    ).toEqual([]);
  });
});

describe('mul-div wrong ideas (P3-07)', () => {
  it.each(['MUL.FACT.10', 'MUL.2D1D', 'DIV.FACT.10', 'DIV.LONG'] as const)(
    'never predict the right answer anywhere in the %s space',
    (skillCode) => {
      const params = SKILL_PARAMS[skillCode];
      for (let index = 0; index < params.size; index += 1) {
        const item = params.at(index);
        if (item === null) throw new Error(`${skillCode} has a gap at ${String(index)}`);
        for (const rule of MUL_DIV_RULES) {
          for (const predicted of predictArithmeticError(rule, item.problem)) {
            expect(
              checkArithmetic(item.problem, predicted).verdict,
              `${skillCode} ${String(index)} ${rule}`,
            ).not.toBe('correct');
          }
        }
      }
    },
  );
});
