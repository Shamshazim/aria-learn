import { describe, expect, it, vi } from 'vitest';

import type { AiAccounting } from '@/ai';
import { createContentCacheService } from '@/content';
import type { ContentItem } from '@/content';
import type { ContentItemRepository } from '@/repositories/content-item.repository';

const LOOKUP = {
  kind: 'question',
  skillCode: 'ADD.FACT.10',
  band: 'early',
  studentId: 'student-b',
} as const;

function accounting(): AiAccounting {
  return {
    assertWithinCap: vi.fn(() => Promise.resolve()),
    record: vi.fn(() => Promise.resolve()),
    recordCachedHit: vi.fn(() => Promise.resolve()),
  };
}

function repository(personalisedFor: string | null): ContentItemRepository {
  const item: ContentItem = {
    id: '00000000-0000-4000-8000-000000000001',
    kind: 'question',
    skillCode: 'ADD.FACT.10',
    band: 'early',
    body: { prompt: 'What is next?' },
    qualityScore: 1,
    sourceModel: null,
    promptName: null,
    promptVersion: null,
    personalisedFor,
    verifiedAt: new Date('2026-08-24T00:00:00Z'),
    timesUsed: 0,
    createdAt: new Date('2026-08-24T00:00:00Z'),
  };
  return {
    insert: vi.fn(() => Promise.reject(new Error('not used'))),
    findEligible: vi.fn(() => Promise.resolve(item)),
    markUsed: vi.fn(() => Promise.resolve()),
    listPrompts: vi.fn(() => Promise.resolve([])),
  };
}

describe('content cache eligibility', () => {
  it('never returns another child personal item even if a repository adapter misbehaves', async () => {
    const repo = repository('student-a');
    const ledger = accounting();
    const cache = createContentCacheService({ repository: repo, accounting: ledger });

    await expect(cache.lookup(LOOKUP)).resolves.toBeNull();
    expect(repo.markUsed).not.toHaveBeenCalled();
    expect(ledger.recordCachedHit).not.toHaveBeenCalled();
  });

  it('marks an eligible hit used and logs zero-cost cached usage', async () => {
    const repo = repository(null);
    const ledger = accounting();
    const cache = createContentCacheService({ repository: repo, accounting: ledger });

    await expect(cache.lookup(LOOKUP)).resolves.toMatchObject({ personalisedFor: null });
    expect(repo.markUsed).toHaveBeenCalledTimes(1);
    expect(ledger.recordCachedHit).toHaveBeenCalledWith({ studentId: 'student-b', tier: 'FAST' });
  });
});
