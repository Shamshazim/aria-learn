import { describe, expect, it } from 'vitest';

import { nextItemFor, toGeneratedContent } from '@/content/generation';
import { parameterSpaceSize } from '@/content/generation/arithmetic';

const LOOKUP = { skillCode: 'ADD.FACT.10', band: 'middle', studentId: 'student-1' } as const;

describe('choosing the next item for a child', () => {
  it('is reproducible for one child and different between children', () => {
    const mine = nextItemFor(LOOKUP, new Set());
    const again = nextItemFor(LOOKUP, new Set());
    const theirs = nextItemFor({ ...LOOKUP, studentId: 'student-2' }, new Set());

    expect(again?.contentHash).toBe(mine?.contentHash);
    expect(theirs?.contentHash).not.toBe(mine?.contentHash);
  });

  it('never returns an item the bank already holds', () => {
    // The bug this exists for: the cache excludes what the child just saw, the generator is
    // asked again, and without this it rebuilds the same item and stores a second row for it.
    const first = nextItemFor(LOOKUP, new Set());
    expect(first).not.toBeNull();
    const second = nextItemFor(LOOKUP, new Set([first?.contentHash ?? '']));

    expect(second?.contentHash).not.toBe(first?.contentHash);
  });

  it('reports no new item once every point of the space is stored', () => {
    const stored = new Set<string>();
    for (let index = 0; index < parameterSpaceSize('ADD.FACT.10'); index += 1) {
      const item = nextItemFor(LOOKUP, stored);
      if (item === null) break;
      stored.add(item.contentHash);
    }

    expect(nextItemFor(LOOKUP, stored)).toBeNull();
  });

  it('carries the hash into the stored body, which is what the next run dedupes against', () => {
    const item = nextItemFor(LOOKUP, new Set());
    if (item === null) throw new Error('expected an item');
    const body: unknown = toGeneratedContent(item, 'question').draft.body;

    expect(body).toMatchObject({ contentHash: item.contentHash, answerKey: item.answerKey });
  });

  it('gates the item as a multiple choice with exactly one correct option', () => {
    const item = nextItemFor(LOOKUP, new Set());
    if (item === null) throw new Error('expected an item');
    const { gateInput } = toGeneratedContent(item, 'question');
    if (gateInput.kind !== 'multiple-choice') throw new Error('expected a multiple-choice gate');

    expect(gateInput.options.filter((option) => option.isCorrect)).toHaveLength(1);
    expect(gateInput.options.find((option) => option.id === gateInput.answerKey)?.text).toBe(
      item.answerKey,
    );
    // Proven by code, not phrased by a model: the gate is told so, and grades it accordingly.
    expect(gateInput.grounding).toBe('approved-source');
  });
});
