import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { sequentialUuids } from '@/lib/ids';
import { createChildSessionRepository } from '@/repositories/child-session.repository';
import { createDeviceGrantRepository } from '@/repositories/device-grant.repository';
import { createParentSessionRepository } from '@/repositories/parent-session.repository';
import { createParentRepository } from '@/repositories/parent.repository';
import { createStudentRepository } from '@/repositories/student.repository';

import { createTestDatabase, shouldSkipDatabaseTests } from './db.harness';

import type { TestDatabase } from './db.harness';

/**
 * Migration 010's device grants and parent sessions, against a real PostgreSQL (P0-28).
 *
 * Every claim here is a claim about Postgres, which is why a fake cannot make it: that the
 * scope insert refuses another family's child, that `array_agg` gives a grant its children
 * back, and that revoking a device ends the sessions it was holding and no others.
 */
const suite = shouldSkipDatabaseTests() ? describe.skip : describe;

const NOW = new Date('2026-08-26T10:00:00.000Z');
const DAY = 24 * 60 * 60 * 1_000;

suite('device grants and parent sessions, migration 010', () => {
  let database: TestDatabase;
  let ids: ReturnType<typeof sequentialUuids>;

  const family = async (children = 1) => {
    const parents = createParentRepository({ db: database.db, ids });
    const students = createStudentRepository({ db: database.db, ids });
    const parent = await parents.insert({
      email: `grown.up.${String(Date.now())}@example.test`,
      displayName: 'Parent',
      supabaseUserId: `supabase-${ids.next()}`,
    });
    const kids = [];
    for (let index = 0; index < children; index += 1) {
      kids.push(
        await students.insert({
          parentId: parent.id,
          displayName: `Kid${String(index)}`,
          grade: '4',
        }),
      );
    }
    return { parent, kids };
  };

  beforeAll(async () => {
    database = await createTestDatabase();
  }, 60_000);

  afterAll(async () => {
    await database.drop();
  });

  beforeEach(async () => {
    await database.truncateAll();
    ids = sequentialUuids();
  });

  describe('device grants', () => {
    it('stores a grant with its scope and gives the children back', async () => {
      const { parent, kids } = await family(2);
      const grants = createDeviceGrantRepository(database.db);

      const grant = await grants.insert({
        id: ids.next(),
        parentId: parent.id,
        label: 'Kitchen tablet',
        secretHash: 'hash-1',
        studentIds: kids.map((kid) => kid.id),
        at: NOW,
      });

      const listed = await grants.listByParent(parent.id);
      expect(listed).toHaveLength(1);
      expect(listed[0]?.id).toBe(grant.id);
      expect([...(listed[0]?.studentIds ?? [])].sort()).toEqual(kids.map((k) => k.id).sort());
    });

    /** The scope insert carries `parent_id`, so a request naming somebody else's child is a no-op. */
    it('refuses to scope a grant to another family’s child', async () => {
      const mine = await family(1);
      const theirs = await family(1);
      const grants = createDeviceGrantRepository(database.db);

      await grants.insert({
        id: ids.next(),
        parentId: mine.parent.id,
        label: 'Tablet',
        secretHash: 'hash-2',
        studentIds: [theirs.kids[0]?.id ?? ''],
        at: NOW,
      });

      const listed = await grants.listByParent(mine.parent.id);
      expect(listed[0]?.studentIds).toEqual([]);
    });

    it('finds a live grant by its secret hash and stops finding it once revoked', async () => {
      const { parent, kids } = await family();
      const grants = createDeviceGrantRepository(database.db);
      const grant = await grants.insert({
        id: ids.next(),
        parentId: parent.id,
        label: 'Tablet',
        secretHash: 'hash-3',
        studentIds: [kids[0]?.id ?? ''],
        at: NOW,
      });

      await expect(grants.findActiveBySecretHash('hash-3')).resolves.toMatchObject({
        id: grant.id,
      });

      await grants.revoke(grant.id, parent.id, NOW);
      await expect(grants.findActiveBySecretHash('hash-3')).resolves.toBeNull();
    });

    it('will not let one parent revoke another’s device', async () => {
      const mine = await family();
      const theirs = await family();
      const grants = createDeviceGrantRepository(database.db);
      const grant = await grants.insert({
        id: ids.next(),
        parentId: mine.parent.id,
        label: 'Tablet',
        secretHash: 'hash-4',
        studentIds: [mine.kids[0]?.id ?? ''],
        at: NOW,
      });

      await expect(grants.revoke(grant.id, theirs.parent.id, NOW)).resolves.toBeNull();
      await expect(grants.findActiveBySecretHash('hash-4')).resolves.not.toBeNull();
    });

    it('ends the sessions a revoked device was holding, and only those', async () => {
      const { parent, kids } = await family();
      const studentId = kids[0]?.id ?? '';
      const grants = createDeviceGrantRepository(database.db);
      const sessions = createChildSessionRepository(database.db);
      const grant = await grants.insert({
        id: ids.next(),
        parentId: parent.id,
        label: 'Lost tablet',
        secretHash: 'hash-5',
        studentIds: [studentId],
        at: NOW,
      });

      const onDevice = await sessions.insert({
        id: ids.next(),
        studentId,
        parentId: parent.id,
        tokenHash: 'token-on-device',
        issuedAt: NOW,
        expiresAt: new Date(NOW.getTime() + DAY),
        deviceLabel: 'Lost tablet',
        deviceGrantId: grant.id,
      });
      // The same child, signed in at home the P2H-12 way: no grant behind it.
      const atHome = await sessions.insert({
        id: ids.next(),
        studentId,
        parentId: parent.id,
        tokenHash: 'token-at-home',
        issuedAt: NOW,
        expiresAt: new Date(NOW.getTime() + DAY),
        deviceLabel: 'Home laptop',
      });

      const ended = await sessions.revokeAllForGrant(grant.id, NOW);

      expect(ended.map((session) => session.id)).toEqual([onDevice.id]);
      await expect(sessions.findLiveByTokenHash('token-at-home', NOW)).resolves.toMatchObject({
        id: atHome.id,
      });
      await expect(sessions.findLiveByTokenHash('token-on-device', NOW)).resolves.toBeNull();
    });
  });

  describe('parent sessions', () => {
    it('creates a row once and returns the same one afterwards', async () => {
      const { parent } = await family();
      const sessions = createParentSessionRepository(database.db);
      const input = {
        parentId: parent.id,
        providerSessionId: 'supabase-session-1',
        at: NOW,
        expiresAt: new Date(NOW.getTime() + 30 * DAY),
      };

      const first = await sessions.upsert({ id: ids.next(), ...input });
      const second = await sessions.upsert({ id: ids.next(), ...input });

      expect(second.id).toBe(first.id);
    });

    /**
     * The bug this guards. If the upsert stamped `last_seen_at` on conflict, every session
     * would look as though it had just been used and the idle window would never close.
     */
    it('does not advance last-seen on the upsert itself', async () => {
      const { parent } = await family();
      const sessions = createParentSessionRepository(database.db);
      const input = {
        parentId: parent.id,
        providerSessionId: 'supabase-session-2',
        at: NOW,
        expiresAt: new Date(NOW.getTime() + 30 * DAY),
      };
      await sessions.upsert({ id: ids.next(), ...input });

      const later = new Date(NOW.getTime() + 8 * DAY);
      const seen = await sessions.upsert({ id: ids.next(), ...input, at: later });

      expect(seen.lastSeenAt.toISOString()).toBe(NOW.toISOString());
    });

    it('signs a parent out of every session at once', async () => {
      const { parent } = await family();
      const sessions = createParentSessionRepository(database.db);
      for (const key of ['a', 'b']) {
        await sessions.upsert({
          id: ids.next(),
          parentId: parent.id,
          providerSessionId: `supabase-session-${key}`,
          at: NOW,
          expiresAt: new Date(NOW.getTime() + 30 * DAY),
        });
      }

      await expect(sessions.revokeAllForParent(parent.id, NOW)).resolves.toBe(2);
      await expect(sessions.revokeAllForParent(parent.id, NOW)).resolves.toBe(0);
    });
  });
});
