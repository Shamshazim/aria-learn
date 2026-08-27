import type { VisualKind } from '@aria/shared';

import type { ArithmeticProblem } from '@/quality/arithmetic';
import { parseInteger, parseRational } from '@/quality/arithmetic/normalise';

type Params = Readonly<Record<string, unknown>>;

/** Sensible pictures for a skill with no open item — the shapes a child sees most often. */
const DEFAULTS: Readonly<Record<VisualKind, Params>> = {
  'number-line': { from: 0, to: 20, step: 1, marks: [] },
  'ten-frame': { total: 10, filled: 0 },
  array: { rows: 2, columns: 5 },
  'fraction-bar': { bars: [{ parts: 4, shaded: 1 }] },
  'place-value-blocks': { groups: [{ tens: 0, ones: 0 }] },
};

/**
 * The renderer-specific parameters for one visual, drawn from the open item where it has them.
 *
 * `params` is `Record<string, unknown>` in the protocol on purpose — the renderer that
 * understands a kind validates its own shape (`content.schema.ts`). This is the one place
 * that decides what goes in, so the two ends have a single author to disagree with.
 */
export function visualParams(kind: VisualKind, problem: ArithmeticProblem | null): Params {
  return fromProblem(kind, problem) ?? DEFAULTS[kind];
}

function fromProblem(kind: VisualKind, problem: ArithmeticProblem | null): Params | null {
  if (problem === null) return null;
  if (problem.kind === 'addition') return fromAddition(kind, problem.left, problem.right);
  if (problem.kind === 'sequence') return fromSequence(kind, problem.values, problem.step);
  return fromFractions(kind, problem.left, problem.right);
}

function fromAddition(kind: VisualKind, leftText: string, rightText: string): Params | null {
  const left = parseInteger(leftText);
  const right = parseInteger(rightText);
  if (left === null || right === null) return null;
  switch (kind) {
    case 'ten-frame':
      return { total: 10, filled: Number(left), adding: Number(right) };
    case 'number-line':
      return { from: 0, to: Number(left + right) + 2, step: 1, marks: [Number(left)] };
    case 'place-value-blocks':
      return {
        groups: [
          { tens: Number(left / 10n), ones: Number(left % 10n) },
          { tens: Number(right / 10n), ones: Number(right % 10n) },
        ],
      };
    default:
      return null;
  }
}

function fromSequence(
  kind: VisualKind,
  values: readonly string[],
  stepText: string,
): Params | null {
  const step = parseInteger(stepText);
  const last = parseInteger(values.at(-1) ?? '');
  if (step === null || last === null) return null;
  if (kind === 'number-line') {
    return { from: 0, to: Number(last + step * 2n), step: Number(step), marks: values.map(Number) };
  }
  if (kind === 'ten-frame') return { total: 10, filled: Number(last % 10n) };
  return null;
}

function fromFractions(kind: VisualKind, leftText: string, rightText: string): Params | null {
  const left = parseRational(leftText, false);
  const right = parseRational(rightText, false);
  if (left === null || right === null) return null;
  if (kind === 'fraction-bar') {
    return {
      bars: [
        { parts: Number(left.denominator), shaded: Number(left.numerator) },
        { parts: Number(right.denominator), shaded: Number(right.numerator) },
      ],
    };
  }
  if (kind === 'array') {
    return { rows: 1, columns: Number(left.denominator), shaded: Number(left.numerator) };
  }
  if (kind === 'number-line') {
    return { from: 0, to: 1, step: 1 / Number(left.denominator), marks: [] };
  }
  return null;
}
