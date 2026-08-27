import { describe, expect, it } from 'vitest';

import { BANDS } from '@aria/shared';

import {
  ARITHMETIC_SKILL_CODES,
  generateItem,
  parameterSpaceSize,
} from '@/content/generation/arithmetic';
import type { GeneratedItem } from '@/content/generation/arithmetic';
import { checkArithmetic } from '@/quality/arithmetic';

/** The ticket's bar: five hundred per skill, every one solved independently. */
const SAMPLE = 500;

/**
 * Five hundred generations per skill, walking every band as well as every index.
 *
 * A skill whose whole space is smaller than five hundred is covered exhaustively and then
 * repeats — `NUM.CNT.SKIP5` has forty-two distinct items across the three bands and no more.
 * The distinctness assertion says exactly how much of the five hundred was new, so nobody
 * reads this as five hundred different problems when it is not.
 */
function sample(skillCode: (typeof ARITHMETIC_SKILL_CODES)[number]): GeneratedItem[] {
  const size = parameterSpaceSize(skillCode);
  const items: GeneratedItem[] = [];
  for (let attempt = 0; attempt < SAMPLE; attempt += 1) {
    const band = BANDS[Math.floor(attempt / size) % BANDS.length];
    if (band === undefined) continue;
    const item = generateItem({ skillCode, band, index: attempt % size });
    if (item !== null) items.push(item);
  }
  return items;
}

describe.each(ARITHMETIC_SKILL_CODES)('%s items', (skillCode) => {
  const items = sample(skillCode);

  it('produces items across the whole parameter space, in every band', () => {
    expect(items).toHaveLength(SAMPLE);
    const distinct = new Set(items.map((item) => item.contentHash));
    expect(distinct.size).toBe(Math.min(SAMPLE, parameterSpaceSize(skillCode) * BANDS.length));
  });

  it('has a key the checker proves, every time', () => {
    for (const item of items) {
      const verdict = checkArithmetic(item.arithmeticProblem, item.answerKey);
      expect(verdict.verdict, `${item.prompt} -> ${item.answerKey}`).toBe('correct');
    }
  });

  it('offers exactly one correct option', () => {
    for (const item of items) {
      const correct = item.choices.filter(
        (choice) => checkArithmetic(item.arithmeticProblem, choice).verdict === 'correct',
      );
      expect(correct, item.prompt).toEqual([item.answerKey]);
    }
  });

  it('labels which wrong idea each distractor offers', () => {
    for (const item of items) {
      expect(item.distractorMisconceptions).toHaveLength(item.choices.length);
      const keyPosition = item.choices.indexOf(item.answerKey);
      expect(item.distractorMisconceptions[keyPosition]).toBeNull();
    }
    // Not every distractor can name a misconception, but across a whole skill some must, or
    // the bank has stopped telling us anything about why a child chose what they chose.
    const named = items.flatMap((item) =>
      item.distractorMisconceptions.filter((id) => id !== null),
    );
    expect(named.length).toBeGreaterThan(0);
  });
});

describe('generation boundaries', () => {
  it('refuses an index past the end of the space rather than wrapping', () => {
    for (const skillCode of ARITHMETIC_SKILL_CODES) {
      expect(
        generateItem({ skillCode, band: 'early', index: parameterSpaceSize(skillCode) }),
      ).toBeNull();
    }
  });

  it('is reproducible: the same index is always the same item', () => {
    for (const skillCode of ARITHMETIC_SKILL_CODES) {
      const first = generateItem({ skillCode, band: 'early', index: 3 });
      const second = generateItem({ skillCode, band: 'early', index: 3 });
      expect(second).toEqual(first);
    }
  });

  it('does not park the answer in one slot a child could learn to tap', () => {
    const positions = [0, 0, 0];
    for (const skillCode of ARITHMETIC_SKILL_CODES) {
      for (let index = 0; index < parameterSpaceSize(skillCode); index += 1) {
        const item = generateItem({ skillCode, band: 'middle', index });
        if (item?.choices.length !== 3) continue;
        const slot = item.choices.indexOf(item.answerKey);
        positions[slot] = (positions[slot] ?? 0) + 1;
      }
    }
    const total = positions.reduce((sum, count) => sum + count, 0);
    for (const count of positions) expect(count / total).toBeGreaterThan(0.28);
  });

  it('phrases the same maths differently for each band', () => {
    const prompts = BANDS.map(
      (band) => generateItem({ skillCode: 'ADD.REGROUP.2D', band, index: 0 })?.prompt,
    );
    expect(new Set(prompts).size).toBeGreaterThan(1);
  });
});
