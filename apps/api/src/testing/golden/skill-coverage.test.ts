import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { ARITHMETIC_SKILL_CODES } from '@/content/generation/arithmetic';
import { loadGoldenItems } from '@/testing/golden/load';
import { skillsBelowMinimum } from '@/testing/golden/skill-coverage';

const ITEMS_DIRECTORY = fileURLToPath(
  new URL('../../../../../dev-docs/golden/content/items', import.meta.url),
);

describe('golden coverage per skill (P3-07)', () => {
  it('gives every arithmetic skill at least five golden cases', async () => {
    const items = await loadGoldenItems(ITEMS_DIRECTORY);
    expect(skillsBelowMinimum(items, ARITHMETIC_SKILL_CODES)).toEqual([]);
  });

  it('names a skill that falls short', () => {
    expect(skillsBelowMinimum([], ['NUM.RND.10'])).toEqual([{ skillCode: 'NUM.RND.10', cases: 0 }]);
  });
});
