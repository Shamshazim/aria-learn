import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { sequentialUuids } from '@/lib/ids';
import { createLearnerMemoryRepository } from '@/repositories/learner-memory.repository';
import { createSessionEventRepository } from '@/repositories/session-event.repository';
import { createSessionRepository } from '@/repositories/session.repository';

import { createTestDatabase, shouldSkipDatabaseTests } from './db.harness';
import { OTHER_SECRET, createIdentityClient } from './identity.client';
import { createIdentityFixture } from './identity.fixture';

import type { TestDatabase } from './db.harness';
import type { IdentityClient } from './identity.client';
import type { IdentityFixture } from './identity.fixture';

/**
 * "Delete means delete" (master-plan.md §12.9), against a real database.
 *
 * These claims are claims about Postgres — that a cascade fires, that it stops at the row it
 * started from, that a ledger row survives the cascade that removed its subject — so they are
 * asserted by counting rows after the fact rather than by trusting the orchestrator's return
 * value. The child under test is given real session and memory rows first, because a deletion
 * that only removes the profile is the failure mode worth catching.
 */
const suite = shouldSkipDatabaseTests() ? describe.skip : describe;

suite('P0-28 — deletion', () => {
  let database: TestDatabase;
  let fixture: IdentityFixture;
  let client: IdentityClient;

  beforeAll(async () => {
    database = await createTestDatabase();
  }, 60_000);
  beforeEach(async () => {
    await database.truncateAll();
    fixture = createIdentityFixture(database);
    client = createIdentityClient(fixture);
  });
  afterAll(async () => database.drop());

  /**
   * Gives a child the history a real one would have, so the cascade has something to carry.
   * One generator for the whole file: two children must not be handed the same row ids.
   */
  const ids = sequentialUuids();

  async function giveHistory(studentId: string): Promise<void> {
    const session = await createSessionRepository({ db: database.pool, ids }).create({
      studentId,
      subject: 'maths',
      grade: '2',
      band: 'early',
    });
    const event = await createSessionEventRepository({
      db: database.pool,
      ids,
      clock: { now: () => fixture.now() },
    }).append({
      sessionId: session.id,
      actor: 'aria',
      kind: 'PRAISE',
      text: 'You kept going.',
      skillCode: null,
      correct: null,
      latencyMs: null,
      evidence: {},
      payload: {},
    });
    await createLearnerMemoryRepository({ db: database.pool, ids }).insertFact({
      studentId,
      kind: 'practice_persistence',
      value: { text: 'Kept going after a wrong answer.' },
      confidence: 0.9,
      firstObservedAt: fixture.now(),
      lastConfirmedAt: fixture.now(),
      expiresAt: null,
      sensitivity: 'normal',
      modelShareable: true,
      evidence: [{ sourceKind: 'session_event', sourceId: event.id }],
    });
    expect(session.studentId).toBe(studentId);
  }

  async function count(table: string, column: string, id: string): Promise<number> {
    const { rows } = await database.pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM ${table} WHERE ${column} = $1`,
      [id],
    );
    return rows[0]?.n ?? 0;
  }

  describe('deleting a child', () => {
    it('removes every row that child owns and leaves the sibling untouched', async () => {
      const adult = await client.signIn();
      await client.consent(adult.token);
      const robin = await client.createChild(adult.token, 'Robin');
      const sam = await client.createChild(adult.token, 'Sam', OTHER_SECRET);
      await client.authoriseDevice(adult.token, [robin, sam]);
      await giveHistory(robin);
      await giveHistory(sam);

      await client.asAdult(adult.token, 'delete', `/api/v1/parent/children/${robin}`).expect(204);

      for (const [table, column] of [
        ['student', 'id'],
        ['session', 'student_id'],
        ['learner_fact', 'student_id'],
        ['device_grant_student', 'student_id'],
      ] as const) {
        expect(await count(table, column, robin)).toBe(0);
        expect(await count(table, column, sam)).toBeGreaterThan(0);
      }
    });

    it('refuses to delete a child belonging to another family', async () => {
      const first = await client.signIn('first@example.com');
      await client.consent(first.token);
      const theirChild = await client.createChild(first.token, 'Robin');

      const second = await client.signIn('second@example.com');
      await client
        .asAdult(second.token, 'delete', `/api/v1/parent/children/${theirChild}`)
        .expect(404);

      expect(await count('student', 'id', theirChild)).toBe(1);
    });

    it('records the deletion in a ledger that outlives the rows it removed', async () => {
      const family = await client.aFamily();
      await client
        .asAdult(family.adult.token, 'delete', `/api/v1/parent/children/${family.studentId}`)
        .expect(204);

      const { rows } = await database.pool.query<{ stage: string; subject_id: string }>(
        'SELECT stage, subject_id FROM deletion_request WHERE subject_kind = $1',
        ['child'],
      );
      expect(rows).toEqual([{ stage: 'complete', subject_id: family.studentId }]);
    });
  });

  describe('deleting an adult', () => {
    it('removes the account, its children, its grants and the provider identity', async () => {
      const family = await client.aFamily();
      await giveHistory(family.studentId);

      // Fresh verification is required, and the fixture's provider answers it in process.
      await client.asAdult(family.adult.token, 'delete', '/api/v1/parent/account').expect(202);

      expect(await count('parent', 'id', family.adult.parentId ?? '')).toBe(0);
      expect(await count('student', 'id', family.studentId)).toBe(0);
      expect(await count('device_grant', 'id', family.device.grantId)).toBe(0);
      expect(await count('adult_identity', 'id', family.adult.adultId)).toBe(0);
      expect(fixture.provider.calls.at(-1)).toMatchObject({ method: 'deleteUser' });
    });

    it('stops honouring the adult token immediately, and the child session with it', async () => {
      const family = await client.aFamily();
      await client.asAdult(family.adult.token, 'delete', '/api/v1/parent/account').expect(202);

      await client.asAdult(family.adult.token, 'get', '/api/v1/auth/adult/me').expect(401);
      await request(fixture.app)
        .delete('/api/v1/child/session')
        .set('x-aria-child-session', family.childToken)
        .expect(401);
    });

    it('leaves a retryable ledger row when the provider call fails, and finishes on replay', async () => {
      const family = await client.aFamily();
      const failing = vi
        .spyOn(fixture.provider, 'deleteUser')
        .mockRejectedValueOnce(new Error('vendor unavailable'));

      await client.asAdult(family.adult.token, 'delete', '/api/v1/parent/account').expect(202);
      failing.mockRestore();

      // The Aria rows are already gone; only the vendor identity is outstanding.
      expect(await count('student', 'id', family.studentId)).toBe(0);
      const pending = await database.pool.query<{ stage: string; attempts: number }>(
        'SELECT stage, attempts FROM deletion_request WHERE completed_at IS NULL',
      );
      expect(pending.rows).toEqual([{ stage: 'local_deleted', attempts: 1 }]);

      const [replayed] = await fixture.runtime.deletion.replayPending();
      expect(replayed?.stage).toBe('complete');
      expect(fixture.provider.deletedSubjects).toHaveLength(1);
    });

    it('replays a request whose subject rows came back with a restore', async () => {
      const family = await client.aFamily();

      // A ledger row written but never acted on — a crash after step 1, or a restore from a
      // backup taken before the deletion ran.
      await database.pool.query(
        `INSERT INTO deletion_request (id, subject_kind, subject_id, provider, provider_subject, stage)
         SELECT gen_random_uuid(), 'adult', id, provider, provider_subject, 'requested'
         FROM adult_identity WHERE id = $1`,
        [family.adult.adultId],
      );

      const [replayed] = await fixture.runtime.deletion.replayPending();

      expect(replayed?.stage).toBe('complete');
      expect(await count('student', 'id', family.studentId)).toBe(0);
      expect(await count('parent', 'id', family.adult.parentId ?? '')).toBe(0);
    });
  });
});
