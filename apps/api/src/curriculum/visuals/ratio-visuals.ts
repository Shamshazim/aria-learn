import type { VisualKind } from '@aria/shared';

import type { ArithmeticProblem } from '@/quality/arithmetic';

type Params = Readonly<Record<string, unknown>>;

/**
 * P3-07: ratios on a number line counted in the ratio's own steps — the top line of a double
 * number line — so "times four" is four equal jumps rather than a rule.
 */
export function ratioParams(
  kind: VisualKind,
  problem: Extract<ArithmeticProblem, { kind: 'ratio-missing' | 'unit-rate' | 'proportion' }>,
): Params | null {
  if (kind !== 'number-line') return null;
  const numbers = ((): readonly number[] => {
    switch (problem.kind) {
      case 'ratio-missing':
        return [Number(problem.first), Number(problem.scaledFirst)];
      case 'unit-rate':
        return [Number(problem.amount) / Number(problem.per), Number(problem.amount)];
      case 'proportion':
        return [1, Number(problem.count), Number(problem.asked)];
    }
  })();
  const [step = 1] = numbers;
  if (!numbers.every((value) => Number.isFinite(value) && value > 0)) return null;
  return { from: 0, to: Math.max(...numbers), step, marks: numbers };
}
