import { describe, expect, it, vi } from 'vitest';

import { fixedClock } from '@/lib/clock';
import { createLogger } from '@/lib/logger';
import type { SessionEventRepository } from '@/repositories/session-event.repository';
import type { SessionRepository } from '@/repositories/session.repository';
import { createEndService } from '@/services/session/end.service';
import type { TutorSessionRecord } from '@/types/session';

const NOW = new Date('2026-08-24T20:00:00.000Z');

describe('session end', () => {
  it('returns before consolidation and contains a later consolidation failure', async () => {
    const session = record();
    let deferred: (() => Promise<void>) | undefined;
    const consolidate = vi.fn(() => Promise.reject(new Error('offline')));
    const cancelAhead = vi.fn();
    const closeVoiceSession = vi.fn(() => Promise.resolve());
    const service = createEndService({
      sessions: repository(session),
      events: events(),
      skillName: () => null,
      clock: fixedClock(NOW),
      consolidation: { consolidate },
      logger: createLogger({ level: 'silent' }),
      schedule: (task) => {
        deferred = task;
      },
      cancelAhead,
      closeVoiceSession,
    });

    await expect(
      service.end({ sessionId: session.id, studentId: session.studentId, reason: 'complete' }),
    ).resolves.toMatchObject({ endReason: 'complete' });
    expect(consolidate).not.toHaveBeenCalled();
    expect(cancelAhead).toHaveBeenCalledWith(session.id);
    expect(closeVoiceSession).toHaveBeenCalledWith(session.id, NOW);
    if (deferred === undefined) throw new Error('Consolidation was not scheduled');
    await expect(deferred()).resolves.toBeUndefined();
  });
});

function repository(session: TutorSessionRecord): SessionRepository {
  const ended = { ...session, endedAt: NOW, endReason: 'complete' as const };
  const value: SessionRepository = {
    withDb: () => value,
    create: vi.fn(() => Promise.resolve(session)),
    findOpen: vi.fn(() => Promise.resolve(session)),
    findById: vi.fn(() => Promise.resolve(session)),
    findLatestEnded: vi.fn(() => Promise.resolve(null)),
    end: vi.fn(() => Promise.resolve(ended)),
    saveSummary: vi.fn((_id: string, summary: string) => Promise.resolve({ ...ended, summary })),
    updatePlan: vi.fn(() => Promise.resolve(session)),
  };
  return value;
}

function events(): SessionEventRepository {
  const value: SessionEventRepository = {
    withDb: () => value,
    append: vi.fn(),
    list: vi.fn(() => Promise.resolve([])),
    findLatestEvidence: vi.fn(() => Promise.resolve(null)),
  };
  return value;
}

function record(): TutorSessionRecord {
  return {
    id: 'session-1',
    studentId: 'student-1',
    subject: 'math',
    grade: '4',
    band: 'middle',
    startedAt: NOW,
    endedAt: null,
    endReason: null,
    plan: {},
    summary: null,
  };
}
