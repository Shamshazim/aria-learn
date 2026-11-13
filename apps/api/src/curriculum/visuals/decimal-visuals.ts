import type { VisualKind } from '@aria/shared';

import type { ArithmeticProblem } from '@/quality/arithmetic';

type Params = Readonly<Record<string, unknown>>;

/**
 * P3-07: decimals on a number line in tenths, and a percent as a hundred-square with that many
 * shaded. The numbers here are for drawing only; nothing is computed from them, so a float is
 * as good as the decimal it was parsed from.
 */
export function decimalParams(
  kind: VisualKind,
  problem: Extract<
    ArithmeticProblem,
    { kind: 'decimal-place' | 'decimal-comparison' | 'decimal-operation' | 'percent-of' }
  >,
): Params | null {
  if (problem.kind === 'percent-of') {
    const percent = Number(problem.percent);
    return kind === 'array' && Number.isInteger(percent) && percent >= 0 && percent <= 100
      ? { rows: 10, columns: 10, shaded: percent }
      : null;
  }
  if (kind !== 'number-line') return null;
  const values = (
    problem.kind === 'decimal-place' ? [problem.number] : [problem.left, problem.right]
  )
    .map(Number)
    .filter((value) => Number.isFinite(value));
  if (values.length === 0) return null;
  const from = Math.floor(Math.min(...values));
  return { from, to: Math.floor(Math.max(...values)) + 1, step: 0.1, marks: values };
}
