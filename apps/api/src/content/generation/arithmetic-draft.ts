import { createHash } from 'node:crypto';

import type { Band } from '@aria/shared';

import type { GeneratedContent } from '@/content/content.service';
import { generateItem, parameterSpaceSize } from '@/content/generation/arithmetic';
import type { GeneratedItem } from '@/content/generation/arithmetic';
import type { ContentKind, ContentLookup, JsonValue } from '@/content/types';
import type { ArithmeticProblem, ArithmeticSkillCode } from '@/quality/arithmetic';
import {
  isAlgebraProblem,
  isMeasureProblem,
  isRationalProblem,
  isSignedOrRatioProblem,
  type AlgebraProblem,
  type MeasureProblem,
  type RationalProblem,
  type SignedOrRatioProblem,
  type WholeNumberProblem,
} from '@/quality/arithmetic/kinds';

const OPTION_IDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;

/**
 * Turns a generated item into something the cache and the gate both understand (P2H-10).
 *
 * The gate input is `multiple-choice` rather than `text` so the structural and correctness
 * checks actually run: exactly one correct option, an answer key that names it, and an
 * arithmetic problem the checker can solve. Grounding is `approved-source` because it is —
 * the source is the checker, not a model.
 */
export function toGeneratedContent(item: GeneratedItem, kind: ContentKind): GeneratedContent {
  const options = item.choices.map((text, position) => ({
    id: OPTION_IDS[position] ?? String(position),
    text,
    isCorrect: text === item.answerKey,
  }));
  const answerKey = options.find((option) => option.isCorrect)?.id ?? OPTION_IDS[0];
  return {
    gateInput: {
      id: `generated-${item.contentHash.slice(0, 16)}`,
      kind: 'multiple-choice',
      band: item.band,
      childText: item.prompt,
      factual: true,
      grounding: 'approved-source',
      options,
      answerKey,
      arithmeticProblem: item.arithmeticProblem,
    },
    draft: {
      kind,
      skillCode: item.skillCode,
      band: item.band,
      body: {
        prompt: item.prompt,
        choices: [...item.choices],
        answerKey: item.answerKey,
        arithmeticProblem: problemJson(item.arithmeticProblem),
        distractorMisconceptions: [...item.distractorMisconceptions],
        // Stored so a later run can recognise this exact item without re-deriving it from the
        // prompt: the bank is what the generator dedupes against.
        contentHash: item.contentHash,
      },
      // Deterministically generated and checker-proven, so no model and no prompt was involved.
      scope: { kind: 'shareable' },
    },
  };
}

/**
 * The structured problem as plain JSON, for the `body` column.
 *
 * Written out rather than serialised through `JSON.parse(JSON.stringify(...))`: the body is
 * re-parsed by `arithmeticProblemSchema` when the item is served, and a copy made by a mapper
 * fails the compiler when the union grows, where a round trip would fail a child instead.
 */
function problemJson(problem: ArithmeticProblem): JsonValue {
  const base = { skillCode: problem.skillCode, kind: problem.kind };
  if (isRationalProblem(problem)) return { ...base, ...rationalFields(problem) };
  if (isSignedOrRatioProblem(problem)) return { ...base, ...signedOrRatioFields(problem) };
  if (isAlgebraProblem(problem)) return { ...base, ...algebraFields(problem) };
  if (isMeasureProblem(problem)) return { ...base, ...measureFields(problem) };
  return { ...base, ...wholeFields(problem) };
}

type Fields = Readonly<Record<string, string | readonly string[]>>;

function wholeFields(problem: WholeNumberProblem): Fields {
  switch (problem.kind) {
    case 'sequence':
      return { values: [...problem.values], step: problem.step };
    case 'place-value':
      return { number: problem.number, place: problem.place };
    case 'rounding':
      return { number: problem.number, to: problem.to };
    case 'addition':
    case 'subtraction':
    case 'multiplication':
    case 'division':
    case 'whole-comparison':
      return { left: problem.left, right: problem.right };
  }
}

function rationalFields(problem: RationalProblem): Fields {
  switch (problem.kind) {
    case 'fraction-missing':
      return { left: problem.left, denominator: problem.denominator };
    case 'fraction-operation':
    case 'decimal-operation':
      return { operation: problem.operation, left: problem.left, right: problem.right };
    case 'decimal-place':
      return { number: problem.number, place: problem.place };
    case 'percent-of':
      return { percent: problem.percent, whole: problem.whole };
    case 'fraction-equality':
    case 'fraction-comparison':
    case 'decimal-comparison':
      return { left: problem.left, right: problem.right };
  }
}

function measureFields(problem: MeasureProblem): Fields {
  switch (problem.kind) {
    case 'elapsed-time':
      return { start: problem.start, minutes: problem.minutes };
    case 'money-change':
      return { paid: problem.paid, cost: problem.cost };
    case 'rectangle':
      return {
        width: problem.width,
        height: problem.height,
        measure: problem.measure,
        unit: problem.unit,
      };
    case 'unit-conversion':
      return { amount: problem.amount, from: problem.from, to: problem.to };
    case 'statistic':
      return { values: [...problem.values], measure: problem.measure };
  }
}

function algebraFields(problem: AlgebraProblem): Fields {
  switch (problem.kind) {
    case 'expression':
      return { expression: problem.expression };
    case 'expression-value':
      return { expression: problem.expression, variable: problem.variable, value: problem.value };
    case 'equation':
      return { left: problem.left, right: problem.right, variable: problem.variable };
  }
}

function signedOrRatioFields(problem: SignedOrRatioProblem): Fields {
  switch (problem.kind) {
    case 'integer-comparison':
      return { left: problem.left, right: problem.right };
    case 'integer-operation':
      return { operation: problem.operation, left: problem.left, right: problem.right };
    case 'absolute-value':
      return { number: problem.number };
    case 'ratio-missing':
      return { first: problem.first, second: problem.second, scaledFirst: problem.scaledFirst };
    case 'unit-rate':
      return {
        amount: problem.amount,
        per: problem.per,
        amountUnit: problem.amountUnit,
        perUnit: problem.perUnit,
      };
    case 'proportion':
      return {
        count: problem.count,
        total: problem.total,
        asked: problem.asked,
        thing: problem.thing,
      };
  }
}

/**
 * The next item this child has not been served, walking the parameter space from their own
 * starting point.
 *
 * Two children on the same skill start at different indices, so the bank does not serve
 * everyone item one; the same child always starts at the same place, so the walk is
 * reproducible from a session log.
 *
 * `storedHashes` is what the bank already holds for this skill and band. Without it the walk
 * would return the same item every time the cache excluded it, and `cache.store` would insert
 * a second row for content that is already there. `null` means every point in the space is
 * already stored — "no new item" — and the caller falls back to the cache rather than
 * inventing one.
 */
export function nextItemFor(
  lookup: Readonly<{ skillCode: ArithmeticSkillCode; band: Band; studentId: string }>,
  storedHashes: ReadonlySet<string>,
): GeneratedItem | null {
  const size = parameterSpaceSize(lookup.skillCode);
  const start = offset(`${lookup.studentId}|${lookup.skillCode}|${lookup.band}`, size);
  for (let step = 0; step < size; step += 1) {
    const item = generateItem({ ...lookup, index: (start + step) % size });
    if (item !== null && !storedHashes.has(item.contentHash)) return item;
  }
  return null;
}

/** A stable starting point per child and skill, derived rather than drawn. */
function offset(seed: string, size: number): number {
  const digest = createHash('sha256').update(seed).digest();
  return size === 0 ? 0 : digest.readUInt32BE(0) % size;
}

export function isArithmeticLookup(
  lookup: ContentLookup,
  codes: readonly string[],
): lookup is ContentLookup & Readonly<{ skillCode: ArithmeticSkillCode }> {
  return codes.includes(lookup.skillCode);
}
