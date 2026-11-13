import type { VisualKind } from '@aria/shared';

import type { ArithmeticProblem } from '@/quality/arithmetic';

type Params = Readonly<Record<string, unknown>>;
type Bar = Readonly<{ parts: number; shaded: number }>;

/** More copies than this do not fit side by side on a tablet; the bar is drawn once with a count. */
const MAX_BARS = 6;

/**
 * P3-07: fraction bars for equivalent fractions and the fraction operations, drawn as the
 * fractions are written rather than reduced — 2/8 is eight parts with two shaded, because the
 * picture is of the question, and reducing it would draw a different one.
 */
export function fractionOperationParams(
  kind: VisualKind,
  problem: Extract<ArithmeticProblem, { kind: 'fraction-missing' | 'fraction-operation' }>,
): Params | null {
  if (kind !== 'fraction-bar') return null;
  if (problem.kind === 'fraction-missing') {
    const left = written(problem.left);
    const parts = Number.parseInt(problem.denominator, 10);
    return left === null || Number.isNaN(parts) ? null : { bars: [left, { parts, shaded: 0 }] };
  }
  const right = written(problem.right);
  if (right === null) return null;
  if (problem.operation === 'multiply') {
    const times = Number.parseInt(problem.left, 10);
    if (Number.isNaN(times)) return null;
    return times > MAX_BARS
      ? { bars: [right], times }
      : { bars: Array.from({ length: times }, () => right) };
  }
  const left = written(problem.left);
  return left === null ? null : { bars: [left, right] };
}

function written(text: string): Bar | null {
  const match = /^\s*(\d+)\s*\/\s*(\d+)\s*$/u.exec(text);
  if (match === null) return null;
  return { parts: Number(match[2]), shaded: Number(match[1]) };
}
