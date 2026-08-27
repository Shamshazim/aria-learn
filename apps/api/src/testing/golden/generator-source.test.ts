import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createGeneratorGoldenSource } from '@/testing/golden/generator-source';
import { gradeGeneration } from '@/testing/golden/graders';
import { loadGoldenItems } from '@/testing/golden/load';
import type { GoldenItem } from '@/testing/golden/types';

const ITEMS = fileURLToPath(
  new URL('../../../../../dev-docs/golden/content/items', import.meta.url),
);

describe('the generator golden source', () => {
  it('passes every check on every checked-in generator case', async () => {
    const cases = (await loadGoldenItems(ITEMS)).filter((item) => item.origin === 'generator');
    const source = createGeneratorGoldenSource({ now: () => 0 });
    expect(cases.length).toBeGreaterThanOrEqual(60);

    for (const item of cases) {
      const result = gradeGeneration(item, await source.generate(item));
      expect(result.failures, item.id).toEqual([]);
    }
  });

  it('refuses a case naming a skill that has no generator', async () => {
    const source = createGeneratorGoldenSource({ now: () => 0 });
    const orphan: GoldenItem = {
      id: 'orphan',
      subject: 'reading',
      skillCode: 'PA.RHYME',
      band: 'early',
      origin: 'generator',
      generatorIndex: 0,
      expectation: {},
      humanReview: { status: 'pending', notes: 'fixture' },
    };

    await expect(source.generate(orphan)).rejects.toThrow(/has no generator/u);
  });
});
