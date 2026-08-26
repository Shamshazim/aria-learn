import { createHash } from 'node:crypto';

import type { Band } from '@aria/shared';

import type { GeneratedContent } from '@/content/content.service';
import { generateItem, parameterSpaceSize } from '@/content/generation/arithmetic';
import type { GeneratedItem } from '@/content/generation/arithmetic';
import type { ContentKind, ContentLookup, JsonValue } from '@/content/types';
import type { ArithmeticProblem, ArithmeticSkillCode } from '@/quality/arithmetic';

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
  return problem.kind === 'sequence'
    ? {
        skillCode: problem.skillCode,
        kind: problem.kind,
        values: [...problem.values],
        step: problem.step,
      }
    : {
        skillCode: problem.skillCode,
        kind: problem.kind,
        left: problem.left,
        right: problem.right,
      };
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
