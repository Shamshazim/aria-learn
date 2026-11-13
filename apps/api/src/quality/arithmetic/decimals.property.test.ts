import { describe, expect, it } from 'vitest';

import { SKILL_PARAMS } from '@/content/generation/arithmetic/params';
import { predictArithmeticError } from '@/curriculum/misconceptions/derived-arithmetic';
import type { ArithmeticRule } from '@/curriculum/misconceptions/signature.types';
import { checkArithmetic } from '@/quality/arithmetic';
import { formatDecimal } from '@/quality/arithmetic/decimal-format';

function lcg(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

/** Independent of the checker: thousandths as integers, written back out by hand. */
function thousandths(value: bigint): string {
  const whole = value / 1000n;
  const part = (value % 1000n).toString().padStart(3, '0').replace(/0+$/u, '');
  return part === '' ? whole.toString() : `${whole.toString()}.${part}`;
}

const RUNS = 10_000;

describe('decimal checkers against integer arithmetic (P3-07)', () => {
  it('add and take away: 10,000 seeded decimals to thousandths', () => {
    const random = lcg(79);
    for (let run = 0; run < RUNS; run += 1) {
      const a = BigInt(Math.floor(random() * 100_000));
      const b = BigInt(Math.floor(random() * 100_000));
      const operation = run % 2 === 0 ? 'add' : 'subtract';
      if (operation === 'subtract' && a < b) continue;
      const problem = {
        skillCode: 'DEC.ADD',
        kind: 'decimal-operation',
        operation,
        left: thousandths(a),
        right: thousandths(b),
      } as const;
      const key = thousandths(operation === 'add' ? a + b : a - b);
      expect(
        checkArithmetic(problem, key).verdict,
        `${problem.left} ${operation} ${problem.right}`,
      ).toBe('correct');
    }
  });

  it('comparison: 10,000 seeded pairs', () => {
    const random = lcg(83);
    for (let run = 0; run < RUNS; run += 1) {
      const a = BigInt(Math.floor(random() * 10_000));
      const b = run % 10 === 0 ? a : BigInt(Math.floor(random() * 10_000));
      const problem = {
        skillCode: 'DEC.CMP',
        kind: 'decimal-comparison',
        left: thousandths(a),
        right: thousandths(b),
      } as const;
      expect(checkArithmetic(problem, a < b ? '<' : a > b ? '>' : '=').verdict).toBe('correct');
    }
  });

  it('percent of: every whole percent of a seeded whole', () => {
    const random = lcg(89);
    for (let run = 0; run < RUNS; run += 1) {
      const percent = BigInt(Math.floor(random() * 101));
      const whole = BigInt(Math.floor(random() * 1000));
      const problem = {
        skillCode: 'PCT.OF',
        kind: 'percent-of',
        percent: percent.toString(),
        whole: whole.toString(),
      } as const;
      const key = formatDecimal({ numerator: percent * whole, denominator: 100n }) ?? '';
      expect(
        checkArithmetic(problem, key).verdict,
        `${percent.toString()}% of ${whole.toString()}`,
      ).toBe('correct');
    }
  });

  it('is exact where floating point is not, and reads every form of a decimal', () => {
    const tenths = {
      skillCode: 'DEC.ADD',
      kind: 'decimal-operation',
      operation: 'add',
      left: '0.1',
      right: '0.2',
    } as const;
    expect(checkArithmetic(tenths, '0.3').verdict).toBe('correct');
    expect(checkArithmetic(tenths, String(0.1 + 0.2)).verdict).toBe('incorrect');
    const sum = {
      skillCode: 'DEC.ADD',
      kind: 'decimal-operation',
      operation: 'add',
      left: '3.4',
      right: '1.2',
    } as const;
    for (const answer of ['4.6', '4.60', '4 3/5', '23/5'])
      expect(checkArithmetic(sum, answer).verdict).toBe('correct');
    const half = {
      skillCode: 'DEC.ADD',
      kind: 'decimal-operation',
      operation: 'add',
      left: '0.25',
      right: '0.25',
    } as const;
    for (const answer of ['.5', '0.5', '0.50', '1/2'])
      expect(checkArithmetic(half, answer).verdict).toBe('correct');
  });
});

const DECIMAL_RULES: readonly ArithmeticRule[] = [
  'decimal-neighbour-digit',
  'decimal-place-amount',
  'decimal-ones-digit',
  'longer-is-larger',
  'shorter-is-larger',
  'reversed-comparison',
  'right-aligned-digits',
  'dropped-decimal-point',
  'decimal-parts-as-wholes',
  'percent-without-hundred',
  'divided-by-percent',
  'subtracted-percent',
];

describe('decimal and percent wrong ideas (P3-07)', () => {
  it.each(['DEC.PV', 'DEC.CMP', 'DEC.ADD', 'PCT.OF'] as const)(
    'never predict an answer the checker calls right, anywhere in the %s space',
    (skillCode) => {
      const params = SKILL_PARAMS[skillCode];
      for (let index = 0; index < params.size; index += 1) {
        const item = params.at(index);
        if (item === null) throw new Error(`${skillCode} has a gap at ${String(index)}`);
        expect(checkArithmetic(item.problem, item.answer).verdict).toBe('correct');
        for (const rule of DECIMAL_RULES) {
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

  it('catches "longer is larger" on every comparison where the shorter decimal is bigger', () => {
    const params = SKILL_PARAMS['DEC.CMP'];
    let seen = 0;
    for (let index = 0; index < params.size; index += 1) {
      const item = params.at(index);
      if (item?.problem.kind !== 'decimal-comparison') continue;
      const [left, right] = [item.problem.left, item.problem.right];
      const shorterIsBigger =
        (left.length < right.length && item.answer === '>') ||
        (left.length > right.length && item.answer === '<');
      if (!shorterIsBigger) continue;
      seen += 1;
      expect(predictArithmeticError('longer-is-larger', item.problem)).toHaveLength(1);
    }
    expect(seen).toBeGreaterThan(10);
  });
});
