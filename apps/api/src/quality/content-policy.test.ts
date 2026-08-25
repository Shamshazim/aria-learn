import { describe, expect, it, vi } from 'vitest';

import { createQualityGate, resolveGatedContent } from '@/quality';
import { VALID_ARITHMETIC_ITEM } from '@/quality/__fixtures__/structural-cases.data';

describe('resolveGatedContent', () => {
  it('regenerates once, records failures, then uses a verified fallback', async () => {
    const gate = createQualityGate(() => ({ safe: true, categories: [] }));
    const fallbackVerdict = gate(VALID_ARITHMETIC_ITEM);
    if (fallbackVerdict.verdict !== 'pass') throw new Error('Fixture must be verified');
    const generate = vi.fn(() =>
      Promise.resolve({ ...VALID_ARITHMETIC_ITEM, childText: '<b>broken</b>' }),
    );
    const recordFailure = vi.fn(() => Promise.resolve());

    const result = await resolveGatedContent({
      generate,
      gate,
      recordFailure,
      fallback: () =>
        Promise.resolve({ content: VALID_ARITHMETIC_ITEM, pass: fallbackVerdict.pass }),
    });

    expect(result.source).toBe('fallback');
    expect(generate).toHaveBeenCalledTimes(2);
    expect(recordFailure).toHaveBeenCalledTimes(2);
  });

  it('returns the regenerated item when the second attempt passes', async () => {
    const gate = createQualityGate(() => ({ safe: true, categories: [] }));
    const generate = vi
      .fn()
      .mockResolvedValueOnce({ ...VALID_ARITHMETIC_ITEM, childText: '<b>broken</b>' })
      .mockResolvedValueOnce(VALID_ARITHMETIC_ITEM);

    const result = await resolveGatedContent({
      generate,
      gate,
      recordFailure: () => Promise.resolve(),
      fallback: () => Promise.reject(new Error('Fallback should not run')),
    });

    expect(result.source).toBe('generated');
    expect(generate).toHaveBeenCalledTimes(2);
  });
});
