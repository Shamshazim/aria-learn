import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';
import { evaluate } from '@/quality/arithmetic/expression';
import { formatFraction } from '@/quality/arithmetic/fraction-format';

/**
 * Evaluating an expression with a letter in it (6.EE.A.2.c): "3n + 4 when n = 5". Mostly a
 * number written against the letter, since reading "3n" is the skill; a bracketed form now and
 * then. Whole, non-negative answers.
 */
const TEMPLATES = ['pv + q', 'pv - q', 'q + pv', 'p(v + q)'] as const;
const VARIABLES = ['n', 'x', 'y'] as const;

type Entry = readonly [string, string, number];

const ENTRIES: readonly Entry[] = TEMPLATES.flatMap((template, t) =>
  [2, 3, 4, 5, 6, 7, 8, 9].flatMap((p) =>
    [1, 3, 4, 6, 7, 10, 12].flatMap((q) =>
      [2, 3, 5, 6, 8, 9].map((value): Entry => {
        const variable = VARIABLES[(t + p + q) % VARIABLES.length] ?? 'n';
        const expression = template
          .replace('p', String(p))
          .replace('q', String(q))
          .replaceAll('v', variable);
        return [expression, variable, value];
      }),
    ),
  ),
)
  .filter(([expression, variable, value]) => {
    const result = evaluate(expression, undefined, {
      name: variable,
      value: { numerator: BigInt(value), denominator: 1n },
    });
    return result !== null && result.numerator >= 0n;
  })
  .filter((_entry, index) => index % 5 === 0);

export const EXP_EVAL_PARAMS: GeneratorParams = {
  skillCode: 'EXP.EVAL',
  size: ENTRIES.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const entry = ENTRIES[index];
  if (entry === undefined) return null;
  const [expression, variable, value] = entry;
  const result = evaluate(expression, undefined, {
    name: variable,
    value: { numerator: BigInt(value), denominator: 1n },
  });
  if (result === null) return null;
  return {
    problem: {
      skillCode: 'EXP.EVAL',
      kind: 'expression-value',
      expression,
      variable,
      value: String(value),
    },
    answer: formatFraction(result),
  };
}
