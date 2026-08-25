import { describe, expect, it, vi } from 'vitest';

import { createFallbackService, createReliableContentService } from '@/content';
import type { ContentCacheService } from '@/content';
import { createInventoryService } from '@/curriculum';
import { ERROR_CODES, ServiceUnavailableError } from '@/errors';
import { createQualityGate } from '@/quality';

const LOOKUP = {
  kind: 'question',
  skillCode: 'ADD.FACT.10',
  band: 'early',
  studentId: 'student-1',
} as const;

function cache(hit: Awaited<ReturnType<ContentCacheService['lookup']>>): ContentCacheService {
  return {
    lookup: vi.fn(() => Promise.resolve(hit)),
    store: vi.fn(() => Promise.reject(new Error('not used'))),
  };
}

describe('reliable content path', () => {
  it('continues with verified fallback when the provider is forced to fail', async () => {
    const gate = createQualityGate(() => ({ safe: true, categories: [] }));
    const service = createReliableContentService({
      cache: cache(null),
      fallback: createFallbackService({ inventory: createInventoryService(), gate }),
      gate,
      generate: () => Promise.reject(new ServiceUnavailableError('provider down')),
      recordFailure: vi.fn(() => Promise.resolve()),
    });

    await expect(service.resolve(LOOKUP)).resolves.toMatchObject({ source: 'fallback' });
  });

  it('serves a cache hit without calling the provider', async () => {
    const generate = vi.fn(() => Promise.reject(new Error('must not run')));
    const hit = {
      id: '00000000-0000-4000-8000-000000000001',
      kind: 'question',
      skillCode: 'ADD.FACT.10',
      band: 'early',
      body: { prompt: 'What is next?' },
      qualityScore: 1,
      sourceModel: null,
      promptName: null,
      promptVersion: null,
      personalisedFor: null,
      verifiedAt: new Date('2026-08-24T00:00:00Z'),
      timesUsed: 0,
      createdAt: new Date('2026-08-24T00:00:00Z'),
    } as const;
    const gate = createQualityGate(() => ({ safe: true, categories: [] }));
    const service = createReliableContentService({
      cache: cache(hit),
      fallback: createFallbackService({ inventory: createInventoryService(), gate }),
      gate,
      generate,
      recordFailure: vi.fn(() => Promise.resolve()),
    });

    await expect(service.resolve(LOOKUP)).resolves.toEqual({
      source: 'cache',
      itemId: hit.id,
      body: hit.body,
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it('raises a typed exhaustion error only when cache, generation and fallback are empty', async () => {
    const gate = createQualityGate(() => ({ safe: true, categories: [] }));
    const service = createReliableContentService({
      cache: cache(null),
      fallback: { get: () => null },
      gate,
      generate: () => Promise.reject(new ServiceUnavailableError('provider down')),
      recordFailure: vi.fn(() => Promise.resolve()),
    });

    await expect(service.resolve(LOOKUP)).rejects.toMatchObject({
      code: ERROR_CODES.SERVICE_UNAVAILABLE,
      safeMessage: 'Temporarily unavailable.',
      status: 503,
    });
  });

  it('does not hide an unexpected generation failure behind fallback content', async () => {
    const gate = createQualityGate(() => ({ safe: true, categories: [] }));
    const programmingFailure = new TypeError('broken generator');
    const service = createReliableContentService({
      cache: cache(null),
      fallback: createFallbackService({ inventory: createInventoryService(), gate }),
      gate,
      generate: () => Promise.reject(programmingFailure),
      recordFailure: vi.fn(() => Promise.resolve()),
    });

    await expect(service.resolve(LOOKUP)).rejects.toBe(programmingFailure);
  });
});
