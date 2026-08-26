import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { sequentialUuids } from '@/lib/ids';
import { createChildCredentialRepository } from '@/repositories/child-credential.repository';
import type { ChildCredentialRepository } from '@/repositories/child-credential.repository';
import { createChildSessionRepository } from '@/repositories/child-session.repository';
import type { ChildSessionRepository } from '@/repositories/child-session.repository';
import { createParentRepository } from '@/repositories/parent.repository';
import { createStudentRepository } from '@/repositories/student.repository';

import { createTestDatabase, shouldSkipDatabaseTests } from './db.harness';

import type { TestDatabase } from './db.harness';

/**
 * Migration 009 against a real PostgreSQL (P2H-12).
 *
 * The claims here are claims about Postgres: that a partial unique index on
 * `parent.supabase_user_id` bites, that `child_session` cascades when a child is deleted, that
 * a settings object survives a round trip through JSONB. A fake would only agree with itself.
 */
const suite = shouldSkipDatabaseTests() ? describe.skip : describe;

const NOW = new Date('2026-08-25T10:00:00.000Z');
const HOUR = 60 * 60 * 1_000;

suite('identity, migration 009', () => {
  let database: TestDatabase;
  let sessions: ChildSessionRepository;
  let credentials: ChildCredentialRepository;
  let ids: ReturnType<typeof sequentialUuids>;

  const family = async (): Promise<Readonly<{ parentId: string; studentId: string }>> => {
    const parents = createParentRepository({ db: database.db, ids });
    const students = createStudentRepository({ db: database.db, ids });
    const parent = await parents.insert({
      email: 'grown.up@example.test',
      displayName: 'Parent',
      supabaseUserId: 'supabase-1',
    });
    const student = await students.insert({
      parentId: parent.id,
      displayName: 'Sam',
      grade: '4',
    });
    return { parentId: parent.id, studentId: student.id };
  };

  const issue = async (
    parentId: string,
    studentId: string,
    tokenHash: string,
    lastSeenAt = NOW,
  ) => {
    const session = await sessions.insert({
      id: ids.next(),
      studentId,
      parentId,
      tokenHash,
      issuedAt: NOW,
      expiresAt: new Date(NOW.getTime() + 12 * HOUR),
      deviceLabel: 'kitchen tablet',
    });
    if (lastSeenAt !== NOW) await sessions.touch(session.id, lastSeenAt);
    return session;
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
    sessions = createChildSessionRepository(database.db);
    credentials = createChildCredentialRepository(database.db);
  });

  it('links a parent row to exactly one Supabase user', async () => {
    const parents = createParentRepository({ db: database.db, ids });
    await parents.insert({ email: null, displayName: 'One', supabaseUserId: 'supabase-1' });

    await expect(parents.findBySupabaseUserId('supabase-1')).resolves.toMatchObject({
      displayName: 'One',
    });
    await expect(
      parents.insert({ email: null, displayName: 'Two', supabaseUserId: 'supabase-1' }),
    ).rejects.toThrow();
    // Two parents with no Supabase account at all are still two parents.
    await parents.insert({ email: null, displayName: 'Three' });
    await parents.insert({ email: null, displayName: 'Four' });
  });

  it('round-trips a child profile through the settings column', async () => {
    const students = createStudentRepository({ db: database.db, ids });
    const { parentId } = await family();
    const student = await students.insert({ parentId, displayName: 'Ada', grade: '1' });

    expect(student.settings).toEqual({ shareFirstName: true, pronunciation: null, avatar: 'fox' });

    const updated = await students.update(student.id, {
      settings: { shareFirstName: false, pronunciation: 'Ay-dah', avatar: 'whale' },
      grade: '7',
    });

    expect(updated).toMatchObject({
      grade: '7',
      band: 'senior',
      settings: { shareFirstName: false, pronunciation: 'Ay-dah', avatar: 'whale' },
    });
  });

  it('finds a live session by its token hash and stops finding a revoked one', async () => {
    const { parentId, studentId } = await family();
    const session = await issue(parentId, studentId, 'hash-1');

    await expect(sessions.findLiveByTokenHash('hash-1', NOW)).resolves.toMatchObject({
      id: session.id,
      studentId,
      parentId,
      deviceLabel: 'kitchen tablet',
    });

    await expect(sessions.revoke(session.id, NOW)).resolves.toBe(true);
    await expect(sessions.findLiveByTokenHash('hash-1', NOW)).resolves.toBeNull();
    // Revoking twice is not an error, and not a second revocation either.
    await expect(sessions.revoke(session.id, NOW)).resolves.toBe(false);
  });

  it('stops finding a session past its absolute deadline', async () => {
    const { parentId, studentId } = await family();
    await issue(parentId, studentId, 'hash-1');

    await expect(
      sessions.findLiveByTokenHash('hash-1', new Date(NOW.getTime() + 13 * HOUR)),
    ).resolves.toBeNull();
  });

  it('refuses two sessions with the same token hash', async () => {
    const { parentId, studentId } = await family();
    await issue(parentId, studentId, 'hash-1');

    await expect(issue(parentId, studentId, 'hash-1')).rejects.toThrow();
  });

  it('rotates in place and leaves the old hash finding nothing', async () => {
    const { parentId, studentId } = await family();
    const session = await issue(parentId, studentId, 'hash-1');

    await sessions.rotate(session.id, 'hash-2', new Date(NOW.getTime() + 60_000));

    await expect(sessions.findLiveByTokenHash('hash-1', NOW)).resolves.toBeNull();
    await expect(sessions.findLiveByTokenHash('hash-2', NOW)).resolves.toMatchObject({
      id: session.id,
    });
  });

  it('revokes every device a parent has, in one statement', async () => {
    const { parentId, studentId } = await family();
    await issue(parentId, studentId, 'hash-1');
    await issue(parentId, studentId, 'hash-2');

    await expect(sessions.revokeAllForParent(parentId, NOW)).resolves.toHaveLength(2);
    await expect(sessions.revokeAllForParent(parentId, NOW)).resolves.toHaveLength(0);
  });

  it('finds the sessions a sweep has to end, by either deadline', async () => {
    const { parentId, studentId } = await family();
    const idle = await issue(parentId, studentId, 'hash-1', new Date(NOW.getTime() - 2 * HOUR));
    await issue(parentId, studentId, 'hash-2');

    const expired = await sessions.findExpired(NOW, new Date(NOW.getTime() - HOUR), 10);

    expect(expired.map((session) => session.id)).toEqual([idle.id]);
  });

  /** master-plan.md §12.9: deleting a family takes its sessions and credentials with it. */
  it('cascades a deleted child into their sessions and credentials', async () => {
    const parents = createParentRepository({ db: database.db, ids });
    const { parentId, studentId } = await family();
    await issue(parentId, studentId, 'hash-1');
    await credentials.upsert({ studentId, pinHash: 'argon2-hash', at: NOW });

    await parents.deleteById(parentId);

    await expect(sessions.findLiveByTokenHash('hash-1', NOW)).resolves.toBeNull();
    await expect(credentials.find(studentId)).resolves.toBeNull();
  });

  it('writes one login method without disturbing the other', async () => {
    const { studentId } = await family();

    await credentials.upsert({ studentId, pinHash: 'pin-hash', at: NOW });
    await credentials.upsert({ studentId, pictureHash: 'picture-hash', at: NOW });

    await expect(credentials.find(studentId)).resolves.toMatchObject({
      pinHash: 'pin-hash',
      pictureHash: 'picture-hash',
      familyDevice: false,
    });

    await credentials.upsert({ studentId, pinHash: null, at: NOW });
    await expect(credentials.find(studentId)).resolves.toMatchObject({
      pinHash: null,
      pictureHash: 'picture-hash',
    });
  });

  it('counts failures and clears them, and forgets a lock when the method changes', async () => {
    const { studentId } = await family();
    await credentials.upsert({ studentId, pinHash: 'pin-hash', at: NOW });

    await credentials.recordFailure(studentId, NOW, null);
    await credentials.recordFailure(studentId, NOW, new Date(NOW.getTime() + 900_000));

    await expect(credentials.find(studentId)).resolves.toMatchObject({
      failedAttempts: 2,
      lockedUntil: new Date(NOW.getTime() + 900_000),
    });

    await credentials.upsert({ studentId, pinHash: 'new-hash', at: NOW });
    await expect(credentials.find(studentId)).resolves.toMatchObject({
      failedAttempts: 0,
      lockedUntil: null,
    });
  });
});
