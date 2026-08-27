import { describe, expect, it } from 'vitest';

import { proportion } from './golden';

describe('voice golden-set reporting', () => {
  it('reports confidence intervals instead of claiming a universal rate from a small set', () => {
    const result = proportion(294, 300);
    expect(result.rate).toBe(0.98);
    expect(result.confidence95.lower).toBeLessThan(0.98);
    expect(result.confidence95.upper).toBeGreaterThan(0.98);
  });
});
