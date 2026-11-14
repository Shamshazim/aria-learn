import { describe, expect, it } from 'vitest';

import { SKILL_PARAMS } from '@/content/generation/arithmetic/params';
import { predictArithmeticError } from '@/curriculum/misconceptions/derived-arithmetic';
import type { ArithmeticRule } from '@/curriculum/misconceptions/signature.types';
import { checkArithmetic } from '@/quality/arithmetic';
import { evaluate } from '@/quality/arithmetic/expression';

function lcg(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

const RUNS = 10_000;
const pick = (random: () => number, low: number, high: number): bigint =>
  BigInt(low + Math.floor(random() * (high - low + 1)));

type Built = Readonly<{ text: string; top: bigint; bottom: bigint }>;

/**
 * A random expression built together with its value, so the reference never parses anything:
 * every operation is computed here as the text is written, with brackets around each part.
 */
function build(random: () => number, depth: number): Built {
  if (depth === 0 || random() < 0.3) {
    const value = pick(random, 1, 12);
    return { text: value.toString(), top: value, bottom: 1n };
  }
  const [left, right] = [build(random, depth - 1), build(random, depth - 1)];
  const operator = ['+', '-', '×', '÷'][Math.floor(random() * 4)] ?? '+';
  const text = `(${left.text} ${operator} ${right.text})`;
  if (operator === '+')
    return {
      text,
      top: left.top * right.bottom + right.top * left.bottom,
      bottom: left.bottom * right.bottom,
    };
  if (operator === '-')
    return {
      text,
      top: left.top * right.bottom - right.top * left.bottom,
      bottom: left.bottom * right.bottom,
    };
  if (operator === '×')
    return { text, top: left.top * right.top, bottom: left.bottom * right.bottom };
  if (right.top === 0n) return { text: left.text, top: left.top, bottom: left.bottom };
  const [top, bottom] = [left.top * right.bottom, left.bottom * right.top];
  return bottom < 0n ? { text, top: -top, bottom: -bottom } : { text, top, bottom };
}

describe('the expression evaluator against values built by hand (P3-07)', () => {
  it('10,000 random bracketed expressions to depth four', () => {
    const random = lcg(109);
    for (let run = 0; run < RUNS; run += 1) {
      const built = build(random, 4);
      const value = evaluate(built.text);
      expect(value, built.text).not.toBeNull();
      if (value === null) continue;
      expect(value.numerator * built.bottom, built.text).toBe(built.top * value.denominator);
    }
  });

  it('10,000 equations checked by substitution, and 10,000 evaluations with a letter', () => {
    const random = lcg(113);
    for (let run = 0; run < RUNS; run += 1) {
      const [p, q, x] = [pick(random, 1, 20), pick(random, -30, 30), pick(random, -20, 20)];
      const sign = q < 0n ? '-' : '+';
      const left = `${p.toString()}x ${sign} ${(q < 0n ? -q : q).toString()}`;
      const equation = {
        skillCode: 'EQN.TWO',
        kind: 'equation',
        left,
        right: (p * x + q).toString(),
        variable: 'x',
      } as const;
      expect(checkArithmetic(equation, x.toString()).verdict, `${left} = ${equation.right}`).toBe(
        'correct',
      );
      expect(checkArithmetic(equation, `x = ${x.toString()}`).verdict).toBe('correct');
      expect(checkArithmetic(equation, (x + 1n).toString()).verdict).toBe('incorrect');
      const n = pick(random, 0, 20);
      const valueProblem = {
        skillCode: 'EXP.EVAL',
        kind: 'expression-value',
        expression: `${p.toString()}n ${sign} ${(q < 0n ? -q : q).toString()}`,
        variable: 'n',
        value: n.toString(),
      } as const;
      expect(checkArithmetic(valueProblem, (p * n + q).toString()).verdict).toBe('correct');
    }
  });

  it.each(['3 +', '(3 + 4', '3 + 4)', '3 & 4', '3y + 1', ''])('refuses %j', (text) => {
    expect(
      evaluate(text, undefined, { name: 'x', value: { numerator: 1n, denominator: 1n } }),
    ).toBeNull();
  });

  it('never asks an order-of-operations item with an unbracketed ÷ chain', () => {
    const params = SKILL_PARAMS['EXP.ORDER'];
    for (let index = 0; index < params.size; index += 1) {
      const item = params.at(index);
      if (item?.problem.kind !== 'expression') continue;
      expect(item.problem.expression, item.problem.expression).not.toMatch(
        /÷\s*\d+\s*[×÷]|[×÷]\s*\d+\s*÷/u,
      );
    }
  });
});

const ALGEBRA_RULES: readonly ArithmeticRule[] = [
  'left-to-right',
  'ignored-brackets',
  'addition-first',
  'concatenated-coefficient',
  'added-coefficient',
  'ignored-coefficient',
  'wrong-inverse',
  'kept-right-side',
  'answered-the-operand',
  'stopped-after-one-step',
  'divided-first',
];

describe('expression and equation wrong ideas (P3-07)', () => {
  it.each(['EXP.ORDER', 'EXP.EVAL', 'EQN.ONE', 'EQN.TWO'] as const)(
    'never predict an answer the checker calls right, anywhere in the %s space',
    (skillCode) => {
      const params = SKILL_PARAMS[skillCode];
      for (let index = 0; index < params.size; index += 1) {
        const item = params.at(index);
        if (item === null) throw new Error(`${skillCode} has a gap at ${String(index)}`);
        expect(checkArithmetic(item.problem, item.answer).verdict).toBe('correct');
        for (const rule of ALGEBRA_RULES) {
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

  it('every order-of-operations item is told apart from at least one wrong order', () => {
    const params = SKILL_PARAMS['EXP.ORDER'];
    for (let index = 0; index < params.size; index += 1) {
      const item = params.at(index);
      if (item === null) continue;
      const caught = (['left-to-right', 'ignored-brackets', 'addition-first'] as const).some(
        (rule) => predictArithmeticError(rule, item.problem).length > 0,
      );
      expect(caught, String(index)).toBe(true);
    }
  });
});
