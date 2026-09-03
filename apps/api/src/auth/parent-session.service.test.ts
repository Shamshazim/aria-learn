import { describe, expect, it } from 'vitest';

import { sequentialUuids } from '@/lib/ids';
import type { ParentSessionRepository } from '@/repositories/parent-session.repository';
import type { ParentSessionRecord } from '@/types/parent-access';

import {
  createParentSessionService,
  PARENT_SESSION_IDLE_MS,
  PARENT_SESSION_MAX_MS,
} from './parent-session.service';

/**
 * A whole in-memory repository rather than a partial fake: the service upserts, then reads
 * what came back, then may touch or revoke. A fake implementing only the method a test
 * happens to reach would pass while the sequence was wrong.
 */
function fakeSessions(): ParentSessionRepository & Readonly<{ rows: Map<string, Row> }> {
  const rows = new Map<string, Row>();
  const repository: ParentSessionRepository = {
    withDb: () => repository,

    upsert: (input) => {
      const existing = rows.get(input.providerSessionId);
      if (existing !== undefined) return Promise.resolve(record(existing));
      const row: Row = {
        id: input.id,
        parentId: input.parentId,
        providerSessionId: input.providerSessionId,
        issuedAt: input.at,
        lastSeenAt: input.at,
        expiresAt: input.expiresAt,
        revokedAt: null,
      };
      rows.set(row.providerSessionId, row);
      return Promise.resolve(record(row));
    },

    touch: (id, at) => {
      const row = byId(rows, id);
      if (row !== undefined) row.lastSeenAt = at;
      return Promise.resolve();
    },

    revoke: (id, at) => {
      const row = byId(rows, id);
      if (row?.revokedAt !== null) return Promise.resolve(false);
      row.revokedAt = at;
      return Promise.resolve(true);
    },

    revokeAllForParent: (parentId, at) => {
      const live = [...rows.values()].filter(
        (row) => row.parentId === parentId && row.revokedAt === null,
      );
      for (const row of live) row.revokedAt = at;
      return Promise.resolve(live.length);
    },
  };
  return Object.assign(repository, { rows });
}

type Row = ParentSessionRecord & { lastSeenAt: Date; revokedAt: Date | null };

function byId(rows: Map<string, Row>, id: string): Row | undefined {
  return [...rows.values()].find((row) => row.id === id);
}

function record(row: Row): ParentSessionRecord {
  return { ...row };
}

const START = new Date('2026-03-01T09:00:00.000Z');
const KEY = { parentId: 'parent-1', sessionKey: 'supabase-session-1' };

/** A clock the test moves. `fixedClock` cannot be wound forward, and these windows are days. */
function movableClock(at: Date) {
  let current = at;
  return { now: () => current, set: (next: Date) => (current = next) };
}

function build(at: Date = START) {
  const clock = movableClock(at);
  const sessions = fakeSessions();
  const service = createParentSessionService({
    sessions,
    clock,
    ids: sequentialUuids(),
  });
  return { service, sessions, clock };
}

describe('the parent session', () => {
  it('is created on the first request of a sign-in', async () => {
    const { service, sessions } = build();

    await expect(service.check(KEY)).resolves.toMatchObject({ status: 'active' });
    expect(sessions.rows.size).toBe(1);
  });

  it('reuses the row on the next request rather than creating a second', async () => {
    const { service, sessions } = build();

    await service.check(KEY);
    await service.check(KEY);

    expect(sessions.rows.size).toBe(1);
  });

  // The bug this guards: an upsert that stamps `last_seen_at` before the caller reads it makes
  // every session look as if it were used a moment ago, and the idle window never fires.
  it('ends a session nobody has used for longer than the idle window', async () => {
    const { service, clock } = build();
    await service.check(KEY);

    clock.set(new Date(START.getTime() + PARENT_SESSION_IDLE_MS + 1_000));

    await expect(service.check(KEY)).resolves.toEqual({ status: 'ended', reason: 'idle' });
  });

  it('keeps a session that is used inside the idle window', async () => {
    const { service, clock } = build();
    await service.check(KEY);

    clock.set(new Date(START.getTime() + PARENT_SESSION_IDLE_MS - 60_000));

    await expect(service.check(KEY)).resolves.toMatchObject({ status: 'active' });
  });

  it('ends a session at its absolute deadline however often it was used', async () => {
    const { service, clock } = build();
    await service.check(KEY);

    // Used every day, so never idle — and still over when the month is up.
    for (let day = 1; day <= 30; day += 1) {
      clock.set(new Date(START.getTime() + day * 24 * 60 * 60 * 1_000));
      await service.check(KEY);
    }
    clock.set(new Date(START.getTime() + PARENT_SESSION_MAX_MS + 1_000));

    await expect(service.check(KEY)).resolves.toEqual({ status: 'ended', reason: 'expired' });
  });

  it('signs a parent out of every device at once', async () => {
    const { service } = build();
    await service.check(KEY);
    await service.check({ ...KEY, sessionKey: 'supabase-session-2' });

    await expect(service.endAllForParent('parent-1')).resolves.toBe(2);

    await expect(service.check(KEY)).resolves.toEqual({ status: 'ended', reason: 'revoked' });
    await expect(service.check({ ...KEY, sessionKey: 'supabase-session-2' })).resolves.toEqual({
      status: 'ended',
      reason: 'revoked',
    });
  });

  it('leaves a different parent signed in', async () => {
    const { service } = build();
    await service.check(KEY);
    await service.check({ parentId: 'parent-2', sessionKey: 'supabase-session-9' });

    await service.endAllForParent('parent-1');

    await expect(
      service.check({ parentId: 'parent-2', sessionKey: 'supabase-session-9' }),
    ).resolves.toMatchObject({ status: 'active' });
  });
});
