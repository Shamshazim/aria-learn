import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { loadGoldenItems } from '@/testing/golden/load';

const ITEMS = fileURLToPath(
  new URL('../../../../../dev-docs/golden/content/items', import.meta.url),
);

/** 500 model cases from P0-21, plus P2H-10's 72 generator cases: twelve per generator. */
const MODEL_CASES = 500;
const GENERATOR_CASES = 72;

describe('content golden files', () => {
  it('loads every unique valid item with the required subject weighting', async () => {
    const items = await loadGoldenItems(ITEMS);
    const model = items.filter((item) => item.origin === 'model');

    expect(items).toHaveLength(MODEL_CASES + GENERATOR_CASES);
    expect(new Set(items.map((item) => item.id)).size).toBe(MODEL_CASES + GENERATOR_CASES);
    expect(model.filter((item) => item.subject === 'arithmetic')).toHaveLength(300);
    expect(model.filter((item) => item.subject === 'reading')).toHaveLength(150);
    expect(model.filter((item) => item.subject === 'writing')).toHaveLength(50);
  });

  it('covers every generator at least ten times', async () => {
    const items = await loadGoldenItems(ITEMS);
    const bySkill = new Map<string, number>();
    for (const item of items.filter((entry) => entry.origin === 'generator')) {
      bySkill.set(item.skillCode, (bySkill.get(item.skillCode) ?? 0) + 1);
    }
    expect(bySkill.size).toBe(6);
    for (const [skillCode, count] of bySkill) expect(count, skillCode).toBeGreaterThanOrEqual(10);
  });

  it('keeps unreviewed expectations visibly release-blocking', async () => {
    const items = await loadGoldenItems(ITEMS);

    expect(items.every((item) => item.humanReview.status === 'pending')).toBe(true);
  });
});
