import type { VisualKind } from '@aria/shared';

import type { ArithmeticProblem } from '@/quality/arithmetic';

type Params = Readonly<Record<string, unknown>>;

/**
 * P3-07: integers on a number line that always shows zero, because every integer idea here —
 * which is bigger, how far from zero, which way a subtraction goes — is about where zero is.
 */
export function integerParams(
  kind: VisualKind,
  problem: Extract<
    ArithmeticProblem,
    { kind: 'integer-comparison' | 'absolute-value' | 'integer-operation' }
  >,
): Params | null {
  if (kind !== 'number-line') return null;
  const marks = (
    problem.kind === 'absolute-value' ? [problem.number] : [problem.left, problem.right]
  )
    .map((text) => Number.parseInt(text, 10))
    .filter((value) => Number.isInteger(value));
  if (marks.length === 0) return null;
  return {
    from: Math.min(0, ...marks) - 1,
    to: Math.max(0, ...marks) + 1,
    step: 1,
    marks,
  };
}
