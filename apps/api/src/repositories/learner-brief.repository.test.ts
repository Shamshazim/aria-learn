import { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import { runQuery } from '@/db/run-query';
import { ConflictError } from '@/errors';
import { sequentialUuids } from '@/lib/ids';

import { createLearnerBriefRepository } from './learner-brief.repository';

vi.mock('@/db/run-query', () => ({ runQuery: vi.fn() }));

describe('learner brief repository', () => {
  it('gives up with a conflict after losing the version race twice', async () => {
    // An empty result is what ON CONFLICT DO NOTHING returns when another writer won.
    vi.mocked(runQuery).mockResolvedValue({ rows: [], rowCount: 0 });
    const repository = createLearnerBriefRepository({ db: new Pool(), ids: sequentialUuids() });

    await expect(
      repository.insertVersion({
        studentId: 's1',
        period: 'week',
        periodStart: '2026-10-05',
        writtenAt: new Date(),
        body: 'A paragraph.',
        evidenceSnapshot: { factIds: [], episodeIds: [], skillCodes: [] },
        generator: 'brief@1',
      }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(vi.mocked(runQuery)).toHaveBeenCalledTimes(2);
  });
});
