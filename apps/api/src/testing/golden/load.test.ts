import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { loadGoldenItems } from '@/testing/golden/load';

const ITEMS = fileURLToPath(
  new URL('../../../../../dev-docs/golden/content/items', import.meta.url),
);

describe('content golden files', () => {
  it('loads 500 unique valid items with the required subject weighting', async () => {
    const items = await loadGoldenItems(ITEMS);

    expect(items).toHaveLength(500);
    expect(new Set(items.map((item) => item.id)).size).toBe(500);
    expect(items.filter((item) => item.subject === 'arithmetic')).toHaveLength(300);
    expect(items.filter((item) => item.subject === 'reading')).toHaveLength(150);
    expect(items.filter((item) => item.subject === 'writing')).toHaveLength(50);
  });

  it('keeps unreviewed expectations visibly release-blocking', async () => {
    const items = await loadGoldenItems(ITEMS);

    expect(items.every((item) => item.humanReview.status === 'pending')).toBe(true);
  });
});
