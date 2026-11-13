import type { VisualKind } from '@aria/shared';

import { decimalParams } from '@/curriculum/visuals/decimal-visuals';
import { fractionOperationParams } from '@/curriculum/visuals/fraction-visuals';
import type { ArithmeticProblem } from '@/quality/arithmetic';
import {
  isRationalProblem,
  type RationalProblem,
  type WholeNumberProblem,
} from '@/quality/arithmetic/kinds';
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
  return isRationalProblem(problem) ? fromRational(kind, problem) : fromWholeNumbers(kind, problem);
}

function fromWholeNumbers(kind: VisualKind, problem: WholeNumberProblem): Params | null {
  switch (problem.kind) {
    case 'addition':
    case 'whole-comparison':
      return fromAddition(kind, problem.left, problem.right);
    case 'subtraction':
      return fromSubtraction(kind, problem.left, problem.right);
    case 'multiplication':
    case 'division':
      return fromGroups(kind, problem.kind, problem.left, problem.right);
    case 'sequence':
      return fromSequence(kind, problem.values, problem.step);
    case 'place-value':
    case 'rounding':
      return fromWhole(kind, problem.number);
  }
}

function fromRational(kind: VisualKind, problem: RationalProblem): Params | null {
  switch (problem.kind) {
    case 'fraction-missing':
    case 'fraction-operation':
      return fractionOperationParams(kind, problem);
    case 'decimal-place':
    case 'decimal-comparison':
    case 'decimal-operation':
    case 'percent-of':
      return decimalParams(kind, problem);
    case 'fraction-equality':
    case 'fraction-comparison':
      return fromFractions(kind, problem.left, problem.right);
  }
}

/** P3-07: one whole number, as tens and ones, or on a number line around it. */
function fromWhole(kind: VisualKind, text: string): Params | null {
  const value = parseInteger(text);
  if (value === null || value < 0n) return null;
  if (kind === 'place-value-blocks') {
    return { groups: [blocks(value)] };
  }
  if (kind === 'number-line') {
    const from = Number((value / 10n) * 10n);
    return { from, to: from + 10, step: 1, marks: [Number(value)] };
  }
  return null;
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
        groups: [blocks(left), blocks(right)],
      };
    default:
      return null;
  }
}

/** P3-07: the whole you start from, and how much of it goes. Nothing is drawn for the answer. */
function fromSubtraction(kind: VisualKind, leftText: string, rightText: string): Params | null {
  const left = parseInteger(leftText);
  const right = parseInteger(rightText);
  if (left === null || right === null) return null;
  switch (kind) {
    case 'ten-frame':
      return { total: 10, filled: Number(left), removing: Number(right) };
    case 'number-line':
      return { from: 0, to: Number(left) + 2, step: 1, marks: [Number(left)] };
    case 'place-value-blocks':
      return { groups: [blocks(left)], removing: Number(right) };
    default:
      return null;
  }
}

/** Rows past this make an array too small to count on a tablet; the blocks are used instead. */
const MAX_ARRAY_SIDE = 12n;

/**
 * P3-07: equal groups. An array of rows and columns while it is small enough to count, else the
 * number in blocks with how many groups it is made into (or shared between).
 */
function fromGroups(
  kind: VisualKind,
  operation: 'multiplication' | 'division',
  leftText: string,
  rightText: string,
): Params | null {
  const left = parseInteger(leftText);
  const right = parseInteger(rightText);
  if (left === null || right === null || right <= 0n) return null;
  const columns = operation === 'multiplication' ? left : left / right;
  if (kind === 'array') {
    return columns > MAX_ARRAY_SIDE || right > MAX_ARRAY_SIDE
      ? null
      : { rows: Number(right), columns: Number(columns) };
  }
  if (kind === 'place-value-blocks') {
    return operation === 'multiplication'
      ? { groups: [blocks(left)], times: Number(right) }
      : { groups: [blocks(left)], sharedBetween: Number(right) };
  }
  return null;
}

/** Tens and ones, and hundreds only once there are any, so two-digit blocks look as before. */
function blocks(value: bigint): Params {
  const tensAndOnes = { tens: Number((value / 10n) % 10n), ones: Number(value % 10n) };
  return value >= 100n
    ? { hundreds: Number(value / 100n), ...tensAndOnes }
    : { tens: Number(value / 10n), ones: Number(value % 10n) };
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
