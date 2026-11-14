import { describe, expect, it } from 'vitest';

import { SKILL_PARAMS } from '@/content/generation/arithmetic/params';
import { predictArithmeticError } from '@/curriculum/misconceptions/derived-arithmetic';
import type { ArithmeticRule } from '@/curriculum/misconceptions/signature.types';
import { checkArithmetic } from '@/quality/arithmetic';

function lcg(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

const RUNS = 10_000;
const between = (random: () => number, low: number, high: number): bigint =>
  BigInt(low + Math.floor(random() * (high - low + 1)));

describe('ratio checkers against BigInt (P3-07)', () => {
  it('equivalent ratios, unit rates and proportions: 10,000 seeded each', () => {
    const random = lcg(103);
    for (let run = 0; run < RUNS; run += 1) {
      const [a, b, k] = [between(random, 1, 50), between(random, 1, 50), between(random, 2, 20)];
      const ratio = {
        skillCode: 'RAT.EQUIV',
        kind: 'ratio-missing',
        first: a.toString(),
        second: b.toString(),
        scaledFirst: (a * k).toString(),
      } as const;
      expect(checkArithmetic(ratio, (b * k).toString()).verdict).toBe('correct');
      const [rate, per] = [between(random, 1, 100), between(random, 1, 20)];
      const unit = {
        skillCode: 'RAT.UNIT',
        kind: 'unit-rate',
        amount: (rate * per).toString(),
        per: per.toString(),
        amountUnit: 'km',
        perUnit: 'hour',
      } as const;
      expect(checkArithmetic(unit, rate.toString()).verdict).toBe('correct');
      const [price, count, asked] = [
        between(random, 1, 30),
        between(random, 1, 12),
        between(random, 1, 40),
      ];
      const proportion = {
        skillCode: 'RAT.PROP',
        kind: 'proportion',
        count: count.toString(),
        total: (price * count).toString(),
        asked: asked.toString(),
        thing: 'pens',
      } as const;
      expect(checkArithmetic(proportion, (price * asked).toString()).verdict).toBe('correct');
    }
  });

  it('dividing fractions: 10,000 seeded, against a reference that multiplies by the flip', () => {
    const random = lcg(107);
    for (let run = 0; run < RUNS; run += 1) {
      const [a, b, c, d] = [
        between(random, 1, 20),
        between(random, 1, 20),
        between(random, 1, 20),
        between(random, 1, 20),
      ];
      const problem = {
        skillCode: 'FRAC.DIV',
        kind: 'fraction-operation',
        operation: 'divide',
        left: `${a.toString()}/${b.toString()}`,
        right: `${c.toString()}/${d.toString()}`,
      } as const;
      expect(checkArithmetic(problem, `${(a * d).toString()}/${(b * c).toString()}`).verdict).toBe(
        'correct',
      );
    }
  });

  it.each(['12', '12 km', '12 km per hour', ' 12 '])('reads %j as twelve km an hour', (answer) => {
    const problem = {
      skillCode: 'RAT.UNIT',
      kind: 'unit-rate',
      amount: '48',
      per: '4',
      amountUnit: 'km',
      perUnit: 'hour',
    } as const;
    expect(checkArithmetic(problem, answer).verdict).toBe('correct');
  });

  it.each(['20', '$20', '$ 20', '20 dollars'])('reads %j as twenty dollars', (answer) => {
    const problem = {
      skillCode: 'RAT.PROP',
      kind: 'proportion',
      count: '3',
      total: '12',
      asked: '5',
      thing: 'pens',
    } as const;
    expect(checkArithmetic(problem, answer).verdict).toBe('correct');
  });
});

const RATIO_RULES: readonly ArithmeticRule[] = [
  'additive-ratio',
  'kept-second-term',
  'answered-the-scale',
  'multiplied-instead',
  'subtracted-instead',
  'kept-total',
  'multiplied-total',
  'flipped-dividend',
  'flipped-both',
];

describe('ratio and fraction-division wrong ideas (P3-07)', () => {
  it.each(['RAT.EQUIV', 'RAT.UNIT', 'RAT.PROP', 'FRAC.DIV'] as const)(
    'never predict an answer the checker calls right, anywhere in the %s space',
    (skillCode) => {
      const params = SKILL_PARAMS[skillCode];
      for (let index = 0; index < params.size; index += 1) {
        const item = params.at(index);
        if (item === null) throw new Error(`${skillCode} has a gap at ${String(index)}`);
        expect(checkArithmetic(item.problem, item.answer).verdict).toBe('correct');
        for (const rule of RATIO_RULES) {
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

  it.each(['RAT.EQUIV', 'RAT.PROP'] as const)(
    'catches adding instead of scaling on every %s item',
    (skillCode) => {
      const params = SKILL_PARAMS[skillCode];
      for (let index = 0; index < params.size; index += 1) {
        const item = params.at(index);
        expect(
          item === null ? [] : predictArithmeticError('additive-ratio', item.problem),
          String(index),
        ).toHaveLength(1);
      }
    },
  );
});
