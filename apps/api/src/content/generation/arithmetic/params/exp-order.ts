import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';
import { evaluate, STANDARD_RULES, type Rules } from '@/quality/arithmetic/expression';
import { formatFraction } from '@/quality/arithmetic/fraction-format';

/**
 * Order of operations (5.OA.A.1, 6.EE.A.2.c). The templates never chain ÷ with another × or ÷
 * unbracketed — the ticket's rule, because "8 ÷ 2 × 2" is a convention, not mathematics — and
 * an item is kept only where at least one wrong order would give a different answer, so a
 * right answer shows the child used the right order rather than happened on it. Whole-number,
 * non-negative answers only.
 */
const TEMPLATES = [
  'a + b × c',
  'a × b + c',
  'a - b × c',
  'a + b ÷ c',
  '(a + b) × c',
  'a × (b + c)',
  'a × (b - c)',
  '(a + b) ÷ c',
  'a - (b + c)',
  'a × b + c × d',
] as const;

const WRONG: readonly Rules[] = [
  { levels: [['+', '-', '×', '÷']], brackets: true },
  {
    levels: [
      ['+', '-'],
      ['×', '÷'],
    ],
    brackets: false,
  },
  {
    levels: [
      ['×', '÷'],
      ['+', '-'],
    ],
    brackets: true,
  },
];

const EXPRESSIONS: readonly string[] = Array.from({ length: 2000 }, (_u, index) => {
  const template = TEMPLATES[index % TEMPLATES.length] ?? TEMPLATES[0];
  const [a, b, c, d] = [
    2 + ((index * 7) % 18),
    2 + ((index * 3) % 8),
    2 + ((index * 5) % 5),
    2 + (index % 4),
  ];
  return template
    .replace('a', String(a))
    .replace('b', String(b))
    .replace('c', String(c))
    .replace('d', String(d));
}).filter((expression, index, all) => {
  const truth = evaluate(expression, STANDARD_RULES);
  if (all.indexOf(expression) !== index || truth?.denominator !== 1n || truth.numerator < 0n) {
    return false;
  }
  return WRONG.some((rules) => {
    const wrong = evaluate(expression, rules);
    return (
      wrong !== null &&
      (wrong.numerator !== truth.numerator || wrong.denominator !== truth.denominator)
    );
  });
});

export const EXP_ORDER_PARAMS: GeneratorParams = {
  skillCode: 'EXP.ORDER',
  size: EXPRESSIONS.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const expression = EXPRESSIONS[index];
  if (expression === undefined) return null;
  const truth = evaluate(expression);
  if (truth === null) return null;
  return {
    problem: { skillCode: 'EXP.ORDER', kind: 'expression', expression },
    answer: formatFraction(truth),
  };
}
