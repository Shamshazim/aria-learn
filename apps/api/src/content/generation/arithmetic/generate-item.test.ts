import { describe, expect, it } from 'vitest';

import { BANDS, type Band } from '@aria/shared';

import {
  ARITHMETIC_SKILL_CODES,
  generateItem,
  parameterSpaceSize,
} from '@/content/generation/arithmetic';
import type { GeneratedItem } from '@/content/generation/arithmetic';
import { checkArithmetic } from '@/quality/arithmetic';

/** The ticket's bar: five hundred per skill, every one solved independently. */
const SAMPLE = 500;

function sample(skillCode: (typeof ARITHMETIC_SKILL_CODES)[number], band: Band): GeneratedItem[] {
  const size = parameterSpaceSize(skillCode);
  const items: GeneratedItem[] = [];
  for (let attempt = 0; attempt < SAMPLE; attempt += 1) {
    const item = generateItem({ skillCode, band, index: attempt % size });
    if (item !== null) items.push(item);
  }
  return items;
}

describe.each(ARITHMETIC_SKILL_CODES)('%s items', (skillCode) => {
  const items = sample(skillCode, 'middle');

  it('produces items across the whole parameter space', () => {
    expect(items).toHaveLength(SAMPLE);
    const distinct = new Set(items.map((item) => item.contentHash));
    expect(distinct.size).toBe(Math.min(SAMPLE, parameterSpaceSize(skillCode)));
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

  it('phrases the same maths differently for each band', () => {
    const prompts = BANDS.map(
      (band) => generateItem({ skillCode: 'ADD.REGROUP.2D', band, index: 0 })?.prompt,
    );
    expect(new Set(prompts).size).toBeGreaterThan(1);
  });
});
