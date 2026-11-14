import { describe, expect, it } from 'vitest';

import { SKILL_PARAMS } from '@/content/generation/arithmetic/params';
import { predictArithmeticError } from '@/curriculum/misconceptions/derived-arithmetic';
import type { ArithmeticRule } from '@/curriculum/misconceptions/signature.types';
import { checkArithmetic } from '@/quality/arithmetic';
import { CONVERSIONS } from '@/quality/arithmetic/units';

function lcg(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

const RUNS = 10_000;
const between = (random: () => number, low: number, high: number): number =>
  low + Math.floor(random() * (high - low + 1));

describe('measurement checkers against references written here (P3-07)', () => {
  it('elapsed time: 10,000 seeded starts and durations on a 12-hour clock', () => {
    const random = lcg(127);
    for (let run = 0; run < RUNS; run += 1) {
      const [hour, minute, added] = [
        between(random, 1, 12),
        between(random, 0, 59),
        between(random, 1, 600),
      ];
      const total = (hour % 12) * 60 + minute + added;
      const endHour = Math.floor((total % 720) / 60) === 0 ? 12 : Math.floor((total % 720) / 60);
      const key = `${String(endHour)}:${String(total % 60).padStart(2, '0')}`;
      const problem = {
        skillCode: 'MEAS.TIME',
        kind: 'elapsed-time',
        start: `${String(hour)}:${String(minute).padStart(2, '0')}`,
        minutes: String(added),
      } as const;
      expect(checkArithmetic(problem, key).verdict, `${problem.start} + ${problem.minutes}`).toBe(
        'correct',
      );
    }
  });

  it('change, rectangles and averages: 10,000 seeded each', () => {
    const random = lcg(131);
    for (let run = 0; run < RUNS; run += 1) {
      const paid = between(random, 1, 100) * 100;
      const cost = between(random, 1, paid);
      const change = paid - cost;
      const money = {
        skillCode: 'MEAS.MONEY',
        kind: 'money-change',
        paid: (paid / 100).toFixed(2),
        cost: (cost / 100).toFixed(2),
      } as const;
      expect(checkArithmetic(money, `${String(change)} cents`).verdict).toBe('correct');
      const [width, height] = [between(random, 1, 50), between(random, 1, 50)];
      const area = {
        skillCode: 'MEAS.AREA',
        kind: 'rectangle',
        width: String(width),
        height: String(height),
        measure: run % 2 === 0 ? 'area' : 'perimeter',
        unit: 'cm',
      } as const;
      expect(
        checkArithmetic(area, String(run % 2 === 0 ? width * height : 2 * (width + height)))
          .verdict,
      ).toBe('correct');
      const values = Array.from({ length: between(random, 3, 8) }, () => between(random, 0, 50));
      const sum = values.reduce((total, value) => total + value, 0);
      const mean = {
        skillCode: 'DATA.MEAN',
        kind: 'statistic',
        values: values.map(String),
        measure: 'mean',
      } as const;
      expect(checkArithmetic(mean, `${String(sum)}/${String(values.length)}`).verdict).toBe(
        'correct',
      );
      const sorted = [...values].sort((a, b) => a - b);
      const half = Math.floor(sorted.length / 2);
      const median2 =
        sorted.length % 2 === 1
          ? 2 * (sorted[half] ?? 0)
          : (sorted[half - 1] ?? 0) + (sorted[half] ?? 0);
      const median = {
        skillCode: 'DATA.MEAN',
        kind: 'statistic',
        values: values.map(String),
        measure: 'median',
      } as const;
      expect(checkArithmetic(median, `${String(median2)}/2`).verdict).toBe('correct');
    }
  });

  it.each(['$1.55', '1.55', '155 cents', '155c', '155¢', '$ 1.55', '1.55 dollars'])(
    'reads %j as $1.55 of change',
    (answer) => {
      const problem = {
        skillCode: 'MEAS.MONEY',
        kind: 'money-change',
        paid: '5.00',
        cost: '3.45',
      } as const;
      expect(checkArithmetic(problem, answer).verdict).toBe('correct');
    },
  );

  it('reads "$1.50", "1.50", "1.5" and "150 cents" as one amount, and a plain 155 as dollars', () => {
    const problem = {
      skillCode: 'MEAS.MONEY',
      kind: 'money-change',
      paid: '2.00',
      cost: '0.50',
    } as const;
    for (const answer of ['$1.50', '1.50', '1.5', '150 cents'])
      expect(checkArithmetic(problem, answer).verdict).toBe('correct');
    expect(checkArithmetic(problem, '150').verdict).toBe('incorrect');
  });

  it('converts by the table, and accepts the unit with the answer', () => {
    for (const [from, targets] of Object.entries(CONVERSIONS)) {
      for (const [to, factor] of Object.entries(targets)) {
        const problem = {
          skillCode: 'MEAS.CONV',
          kind: 'unit-conversion',
          amount: '7',
          from,
          to,
        } as const;
        expect(checkArithmetic(problem, (7n * factor).toString()).verdict).toBe('correct');
        expect(
          checkArithmetic(problem, `${(7n * factor).toString()} ${to}`).verdict,
          `${from}→${to}`,
        ).toBe('correct');
      }
    }
    const area = {
      skillCode: 'MEAS.AREA',
      kind: 'rectangle',
      width: '6',
      height: '4',
      measure: 'area',
      unit: 'cm',
    } as const;
    for (const answer of ['24', '24 cm²', '24 square cm', '24 sq cm'])
      expect(checkArithmetic(area, answer).verdict).toBe('correct');
  });
});

const MEASURE_RULES: readonly ArithmeticRule[] = [
  'minutes-as-hundreds',
  'hour-not-carried',
  'minutes-replaced',
  'smaller-from-larger',
  'added-instead',
  'dropped-decimal-point',
  'swapped-measure',
  'added-two-sides',
  'one-side-squared',
  'divided-instead',
  'used-ten',
  'wrong-factor',
  'median-unsorted',
  'sum-not-divided',
];

describe('measurement and data wrong ideas (P3-07)', () => {
  it.each(['MEAS.TIME', 'MEAS.MONEY', 'MEAS.AREA', 'MEAS.CONV', 'DATA.MEAN'] as const)(
    'never predict an answer the checker calls right, anywhere in the %s space',
    (skillCode) => {
      const params = SKILL_PARAMS[skillCode];
      for (let index = 0; index < params.size; index += 1) {
        const item = params.at(index);
        if (item === null) throw new Error(`${skillCode} has a gap at ${String(index)}`);
        expect(checkArithmetic(item.problem, item.answer).verdict).toBe('correct');
        for (const rule of MEASURE_RULES) {
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

  it('catches "2:75" on every elapsed-time item, since every one crosses the hour', () => {
    const params = SKILL_PARAMS['MEAS.TIME'];
    for (let index = 0; index < params.size; index += 1) {
      const item = params.at(index);
      expect(
        item === null ? [] : predictArithmeticError('minutes-as-hundreds', item.problem),
      ).toHaveLength(1);
    }
  });
});
