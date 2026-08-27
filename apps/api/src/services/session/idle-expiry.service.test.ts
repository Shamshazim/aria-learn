import { describe, expect, it, vi } from 'vitest';

import { sequentialUuids } from '@/lib/ids';
import type { SessionEventRepository } from '@/repositories/session-event.repository';
import { createIdleExpiryService } from '@/services/session/idle-expiry.service';
import type { ChildSessionRecord } from '@/types/auth';
import type { TutorSessionRecord } from '@/types/session';

const NOW = new Date('2026-08-25T10:00:00.000Z');

const CHILD_SESSION: ChildSessionRecord = {
  id: 'child-session-1',
  studentId: 'student-1',
  parentId: 'parent-1',
  issuedAt: NOW,
  lastSeenAt: NOW,
  expiresAt: new Date(NOW.getTime() + 3_600_000),
  revokedAt: null,
  deviceLabel: null,
};

const OPEN_SESSION: TutorSessionRecord = {
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

/** What the repository would have written back: the event, with the row's own fields filled. */
function appended(
  event: Parameters<SessionEventRepository['append']>[0],
): Awaited<ReturnType<SessionEventRepository['append']>> {
  return { ...event, id: 'event-1', seq: 1, at: event.at ?? NOW };
}

function build(overrides: Partial<Parameters<typeof createIdleExpiryService>[0]> = {}) {
  const append = vi.fn((event: Parameters<SessionEventRepository['append']>[0]) =>
    Promise.resolve(appended(event)),
  );
  const end = vi.fn(() => Promise.resolve(OPEN_SESSION));
  const revoke = vi.fn(() => Promise.resolve());
  const deps = {
    childSessions: { expired: () => Promise.resolve([CHILD_SESSION]), revoke },
    sessions: { findOpen: () => Promise.resolve(OPEN_SESSION) },
    events: { append },
    end,
    ids: sequentialUuids(),
    clock: { now: () => NOW },
    logger: { info: vi.fn(), warn: vi.fn() },
    ...overrides,
  };
  return { service: createIdleExpiryService(deps), append, end, revoke, logger: deps.logger };
}

describe('idle expiry', () => {
  /** P2H-12: "PAUSE then LEAVE" — the transcript says what happened, in order. */
  it('records a pause and a leave before ending the lesson', async () => {
    const { service, append, end } = build();

    await service.endFor(CHILD_SESSION);

    expect(append.mock.calls.map(([event]) => event.kind)).toEqual(['PAUSE', 'LEAVE']);
    expect(end).toHaveBeenCalledWith({
      sessionId: 'session-1',
      studentId: 'student-1',
      reason: 'timeout',
    });
  });

  it('does nothing to a child who had no lesson open', async () => {
    const { service, append, end } = build({ sessions: { findOpen: () => Promise.resolve(null) } });

    await service.endFor(CHILD_SESSION);

    expect(append).not.toHaveBeenCalled();
    expect(end).not.toHaveBeenCalled();
  });

  it('revokes the cookie before it ends the lesson behind it', async () => {
    const order: string[] = [];
    const revoke = vi.fn(() => {
      order.push('revoke');
      return Promise.resolve();
    });
    const append = vi.fn((event: Parameters<SessionEventRepository['append']>[0]) => {
      order.push('append');
      return Promise.resolve(appended(event));
    });
    const { service } = build({
      childSessions: { expired: () => Promise.resolve([CHILD_SESSION]), revoke },
      events: { append },
    });

    await expect(service.sweep()).resolves.toBe(1);
    expect(order[0]).toBe('revoke');
  });

  /** One family's stuck row must not stop the rest of the sweep. */
  it('keeps going when one session cannot be ended, and says so', async () => {
    const second = { ...CHILD_SESSION, id: 'child-session-2', studentId: 'student-2' };
    const revoke = vi.fn((session: ChildSessionRecord) =>
      session.id === CHILD_SESSION.id
        ? Promise.reject(new Error('row is locked'))
        : Promise.resolve(),
    );
    const { service, logger } = build({
      childSessions: { expired: () => Promise.resolve([CHILD_SESSION, second]), revoke },
    });

    await expect(service.sweep()).resolves.toBe(1);
    expect(logger.warn).toHaveBeenCalled();
  });
});
