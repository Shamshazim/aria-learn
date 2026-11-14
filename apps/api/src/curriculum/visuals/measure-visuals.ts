import type { VisualKind } from '@aria/shared';

import type { MeasureProblem } from '@/quality/arithmetic/kinds';

type Params = Readonly<Record<string, unknown>>;

/** Sides past this make squares too small to count on a tablet. */
const MAX_SIDE = 12;

/**
 * P3-07: a rectangle as an array of unit squares, so area is the squares and perimeter the
 * edge; a data set on a number line, so the middle and the balance point can be seen. Time,
 * money and units use the defaults.
 */
export function measureParams(kind: VisualKind, problem: MeasureProblem): Params | null {
  if (problem.kind === 'rectangle' && kind === 'array') {
    const [columns, rows] = [Number(problem.width), Number(problem.height)];
    return columns > MAX_SIDE || rows > MAX_SIDE ? null : { rows, columns };
  }
  if (problem.kind === 'statistic' && kind === 'number-line') {
    const marks = problem.values.map(Number).filter((value) => Number.isFinite(value));
    if (marks.length === 0) return null;
    return { from: Math.min(0, ...marks), to: Math.max(...marks) + 1, step: 1, marks };
  }
  return null;
}
