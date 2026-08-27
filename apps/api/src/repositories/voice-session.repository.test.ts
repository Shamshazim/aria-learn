import { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import { runQuery } from '@/db/run-query';

import { createVoiceSessionRepository } from './voice-session.repository';

vi.mock('@/db/run-query', () => ({ runQuery: vi.fn() }));

describe('voice session repository', () => {
  it('rejects malformed session identifiers returned by the database', async () => {
    vi.mocked(runQuery).mockResolvedValue({
      rows: [{ session_id: 'not-a-session-id', connection_epoch: 2 }],
      rowCount: 1,
    });
    const repository = createVoiceSessionRepository(new Pool());

    await expect(repository.closeForStudent(crypto.randomUUID(), new Date())).rejects.toThrow();
  });
});
