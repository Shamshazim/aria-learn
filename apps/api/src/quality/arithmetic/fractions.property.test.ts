import { describe, expect, it } from 'vitest';

import { SKILL_PARAMS } from '@/content/generation/arithmetic/params';
import { ARITHMETIC_SKILLS } from '@/curriculum/inventory/arithmetic';
import { predictArithmeticError } from '@/curriculum/misconceptions/derived-arithmetic';
import type { ArithmeticRule } from '@/curriculum/misconceptions/signature.types';
import { checkArithmetic, procedureSteps, type ArithmeticSkillCode } from '@/quality/arithmetic';

function lcg(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

/** Independent of the checker: cross-multiply, then reduce with a gcd written here. */
function reference(
  op: 'add' | 'subtract' | 'multiply',
  [a, b]: readonly [bigint, bigint],
  [c, d]: readonly [bigint, bigint],
): string {
  const top = op === 'add' ? a * d + c * b : op === 'subtract' ? a * d - c * b : a * c;
  const bottom = b * d;
  const g = euclid(top < 0n ? -top : top, bottom);
  return `${(top / g).toString()}/${(bottom / g).toString()}`;
}

function euclid(x: bigint, y: bigint): bigint {
  return y === 0n ? x : euclid(y, x % y);
}

const RUNS = 10_000;

describe('fraction checkers against BigInt (P3-07)', () => {
  it('add, take away and times: 10,000 seeded operations, answered as improper fractions', () => {
    const random = lcg(71);
    const ops = ['add', 'subtract', 'multiply'] as const;
    for (let run = 0; run < RUNS; run += 1) {
      const [b, d] = [BigInt(Math.floor(random() * 11) + 2), BigInt(Math.floor(random() * 11) + 2)];
      const [a, c] = [BigInt(Math.floor(random() * 12) + 1), BigInt(Math.floor(random() * 12) + 1)];
      const operation = ops[run % 3] ?? 'add';
      if (operation === 'subtract' && a * d < c * b) continue;
      const problem = {
        skillCode: 'FRAC.ADD.UNLIKE',
        kind: 'fraction-operation',
        operation,
        left: `${a.toString()}/${b.toString()}`,
        right: `${c.toString()}/${d.toString()}`,
      } as const;
      const key = reference(operation, [a, b], [c, d]);
      expect(
        checkArithmetic(problem, key).verdict,
        `${problem.left} ${operation} ${problem.right}`,
      ).toBe('correct');
    }
  });

  it('missing numerators: 10,000 seeded equivalences', () => {
    const random = lcg(73);
    for (let run = 0; run < RUNS; run += 1) {
      const bottom = BigInt(Math.floor(random() * 11) + 2);
      const top = BigInt(Math.floor(random() * Number(bottom - 1n)) + 1);
      const factor = BigInt(Math.floor(random() * 9) + 2);
      const problem = {
        skillCode: 'FRAC.EQUIV',
        kind: 'fraction-missing',
        left: `${top.toString()}/${bottom.toString()}`,
        denominator: (bottom * factor).toString(),
      } as const;
      expect(checkArithmetic(problem, (top * factor).toString()).verdict).toBe('correct');
      expect(checkArithmetic(problem, (top * factor + 1n).toString()).verdict).toBe('incorrect');
    }
  });

  it.each(['1/2', '2/4', '0.5', '0.50', 'one half', 'a half', '½', ' 1 / 2 '])(
    'accepts %j for 1/4 add 1/4',
    (answer) => {
      const problem = {
        skillCode: 'FRAC.ADD.LIKE',
        kind: 'fraction-operation',
        operation: 'add',
        left: '1/4',
        right: '1/4',
      } as const;
      expect(checkArithmetic(problem, answer).verdict).toBe('correct');
    },
  );

  it('accepts a mixed number, an improper fraction and a decimal for six fifths', () => {
    const problem = {
      skillCode: 'FRAC.MUL.WHOLE',
      kind: 'fraction-operation',
      operation: 'multiply',
      left: '3',
      right: '2/5',
    } as const;
    for (const answer of ['1 1/5', '6/5', '1.2', '12/10'])
      expect(checkArithmetic(problem, answer).verdict).toBe('correct');
    expect(checkArithmetic(problem, '6/15').verdict).toBe('incorrect');
  });
});

const FRACTION_RULES: readonly ArithmeticRule[] = [
  'additive-equivalence',
  'kept-numerator',
  'answered-the-factor',
  'combined-denominators',
  'numerator-only',
  'flipped-operation',
  'kept-one-denominator',
  'renamed-denominators-only',
  'multiplied-both',
  'added-whole',
  'multiplied-denominator',
];

describe('fraction wrong ideas (P3-07)', () => {
  it.each(['FRAC.EQUIV', 'FRAC.ADD.LIKE', 'FRAC.ADD.UNLIKE', 'FRAC.MUL.WHOLE'] as const)(
    'never predict an answer the checker calls right, anywhere in the %s space',
    (skillCode) => {
      const params = SKILL_PARAMS[skillCode];
      for (let index = 0; index < params.size; index += 1) {
        const item = params.at(index);
        if (item === null) throw new Error(`${skillCode} has a gap at ${String(index)}`);
        expect(checkArithmetic(item.problem, item.answer).verdict).toBe('correct');
        for (const rule of FRACTION_RULES) {
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

describe('every procedure skill has steps (P3-07)', () => {
  const procedures = ARITHMETIC_SKILLS.filter((skill) => skill.mode === 'procedure').map(
    (skill) => skill.code as ArithmeticSkillCode,
  );

  it('covers every procedure skill in the inventory', () => {
    expect(procedures).toEqual(
      expect.arrayContaining(['ADD.REGROUP.2D', 'DIV.LONG', 'FRAC.ADD.UNLIKE']),
    );
  });

  it.each(procedures)(
    '%s: at least two steps for every item, and no prompt gives the answer',
    (skillCode) => {
      const params = SKILL_PARAMS[skillCode];
      for (let index = 0; index < params.size; index += 1) {
        const item = params.at(index);
        if (item === null) continue;
        const steps = procedureSteps(item.problem);
        expect(steps.length, `${skillCode} ${String(index)}`).toBeGreaterThanOrEqual(2);
        for (const step of steps) expect(step.prompt).not.toContain(item.answer);
      }
    },
  );

  it('works 1/2 add 1/3 as written on paper', () => {
    const steps = procedureSteps({
      skillCode: 'FRAC.ADD.UNLIKE',
      kind: 'fraction-operation',
      operation: 'add',
      left: '1/2',
      right: '1/3',
    });
    expect(steps.map((step) => step.answer)).toEqual(['6', '3', '2', '5']);
  });
});
