import { describe, expect, it } from 'vitest';

import { SKILL_PARAMS } from '@/content/generation/arithmetic/params';
import { predictArithmeticError } from '@/curriculum/misconceptions/derived-arithmetic';
import type { ArithmeticRule } from '@/curriculum/misconceptions/signature.types';
import { checkArithmetic } from '@/quality/arithmetic';
import { parseInteger } from '@/quality/arithmetic/normalise';

function lcg(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

const RUNS = 10_000;
const signed = (random: () => number, size: number): bigint =>
  BigInt(Math.floor(random() * (2 * size + 1)) - size);

describe('integer checkers against BigInt (P3-07)', () => {
  it('add, take away, times and exact divide: 10,000 seeded operations', () => {
    const random = lcg(97);
    const operations = ['add', 'subtract', 'multiply', 'divide'] as const;
    for (let run = 0; run < RUNS; run += 1) {
      const operation = operations[run % 4] ?? 'add';
      let left = signed(random, 500);
      const right = signed(random, 50);
      if (operation === 'divide') {
        if (right === 0n) continue;
        left = right * signed(random, 50);
      }
      const truth =
        operation === 'add'
          ? left + right
          : operation === 'subtract'
            ? left - right
            : operation === 'multiply'
              ? left * right
              : left / right;
      const problem = {
        skillCode: operation === 'add' || operation === 'subtract' ? 'INT.ADD' : 'INT.MUL',
        kind: 'integer-operation',
        operation,
        left: left.toString(),
        right: right.toString(),
      } as const;
      expect(
        checkArithmetic(problem, truth.toString()).verdict,
        `${problem.left} ${operation} ${problem.right}`,
      ).toBe('correct');
      if (truth !== 0n)
        expect(checkArithmetic(problem, (-truth).toString()).verdict).toBe('incorrect');
    }
  });

  it('comparison and absolute value: 10,000 seeded integers', () => {
    const random = lcg(101);
    for (let run = 0; run < RUNS; run += 1) {
      const [left, right] = [signed(random, 1000), run % 10 === 0 ? 0n : signed(random, 1000)];
      const comparison = {
        skillCode: 'INT.CMP',
        kind: 'integer-comparison',
        left: left.toString(),
        right: right.toString(),
      } as const;
      expect(
        checkArithmetic(comparison, left < right ? '<' : left > right ? '>' : '=').verdict,
      ).toBe('correct');
      const absolute = {
        skillCode: 'INT.ABS',
        kind: 'absolute-value',
        number: left.toString(),
      } as const;
      expect(checkArithmetic(absolute, (left < 0n ? -left : left).toString()).verdict).toBe(
        'correct',
      );
    }
  });

  it.each([
    ['-5', -5n],
    ['−5', -5n],
    ['negative five', -5n],
    ['minus 5', -5n],
    ['Negative twenty one', -21n],
    ['-0', 0n],
  ] as const)('reads %j as %s', (text, value) => {
    expect(parseInteger(text)).toBe(value);
  });

  it('refuses "negative minus five" rather than guessing', () => {
    expect(parseInteger('negative minus five')).toBeNull();
  });
});

const INTEGER_RULES: readonly ArithmeticRule[] = [
  'absolute-value-comparison',
  'reversed-comparison',
  'zero-is-smallest',
  'kept-sign',
  'negated',
  'counted-zero',
  'wrong-sign',
  'minus-negative-as-minus',
  'magnitudes-added',
  'sign-of-first-factor',
  'added-instead',
];

describe('integer wrong ideas (P3-07)', () => {
  it.each(['INT.CMP', 'INT.ABS', 'INT.ADD', 'INT.MUL'] as const)(
    'never predict an answer the checker calls right, anywhere in the %s space',
    (skillCode) => {
      const params = SKILL_PARAMS[skillCode];
      for (let index = 0; index < params.size; index += 1) {
        const item = params.at(index);
        if (item === null) throw new Error(`${skillCode} has a gap at ${String(index)}`);
        expect(checkArithmetic(item.problem, item.answer).verdict).toBe('correct');
        for (const rule of INTEGER_RULES) {
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

  it('catches "size, not sign" on every pair of different negatives', () => {
    const params = SKILL_PARAMS['INT.CMP'];
    let seen = 0;
    for (let index = 0; index < params.size; index += 1) {
      const item = params.at(index);
      if (item?.problem.kind !== 'integer-comparison') continue;
      const [left, right] = [Number(item.problem.left), Number(item.problem.right)];
      if (left >= 0 || right >= 0 || left === right) continue;
      seen += 1;
      expect(predictArithmeticError('absolute-value-comparison', item.problem)).toHaveLength(1);
    }
    expect(seen).toBeGreaterThan(10);
  });
});
