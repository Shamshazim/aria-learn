import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { sequentialUuids } from '@/lib/ids';
import { createConsentRecordRepository } from '@/repositories/consent-record.repository';
import { createDeletionRequestRepository } from '@/repositories/deletion-request.repository';
import { createParentRepository } from '@/repositories/parent.repository';
import { createStudentRepository } from '@/repositories/student.repository';

import { createTestDatabase, shouldSkipDatabaseTests } from './db.harness';

import type { TestDatabase } from './db.harness';

/**
 * Migration 010's consent records and deletion ledger, against a real PostgreSQL (P0-28).
 *
 * The important claim is the last one: the ledger outlives the parent whose deletion it
 * records. A foreign key there would cascade away the evidence that the erasure happened,
 * which is the one record a regulator would actually ask for.
 */
const suite = shouldSkipDatabaseTests() ? describe.skip : describe;

const NOW = new Date('2026-08-26T10:00:00.000Z');

suite('consent and erasure, migration 010', () => {
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

  describe('consent', () => {
    it('returns the newest live consent and nothing once withdrawn', async () => {
      const { parent } = await family();
      const consents = createConsentRecordRepository(database.db);
      await consents.insert({
        id: ids.next(),
        parentId: parent.id,
        method: 'credit_card',
        sourceReference: 'card-1',
        disclosureVersion: 'v1',
        at: NOW,
      });

      await expect(consents.findActive(parent.id)).resolves.toMatchObject({
        method: 'credit_card',
      });

      await consents.withdrawAll(parent.id, NOW);

      await expect(consents.findActive(parent.id)).resolves.toBeNull();
      // Withdrawn, never deleted: the record that consent was given is why data existed.
      await expect(consents.listByParent(parent.id)).resolves.toHaveLength(1);
    });

    it('refuses a method the schema does not name', async () => {
      const { parent } = await family();

      await expect(
        database.db.query(
          `INSERT INTO consent_record (id, parent_id, method, disclosure_version)
           VALUES ($1, $2, 'pinky_promise', 'v1')`,
          [ids.next(), parent.id],
        ),
      ).rejects.toMatchObject({ code: '23514' });
    });
  });

  describe('the deletion ledger', () => {
    /**
     * The reason `subject_id` is not a foreign key. A cascade would erase the evidence that
     * the erasure happened, which is the one record a regulator would actually ask for.
     */
    it('outlives the parent it records the deletion of', async () => {
      const { parent } = await family();
      const ledger = createDeletionRequestRepository(database.db);
      const request = await ledger.open({
        id: ids.next(),
        subjectKind: 'account',
        subjectId: parent.id,
        parentId: parent.id,
        providerSubject: 'supabase-user-1',
        at: NOW,
      });

      await createParentRepository({ db: database.db, ids }).deleteById(parent.id);

      const after = await ledger.findById(request.id);
      expect(after).toMatchObject({ subjectId: parent.id, providerSubject: 'supabase-user-1' });
    });

    it('lists what is unfinished and forgets what is complete', async () => {
      const { parent } = await family();
      const ledger = createDeletionRequestRepository(database.db);
      const open = await ledger.open({
        id: ids.next(),
        subjectKind: 'child',
        subjectId: ids.next(),
        parentId: parent.id,
        providerSubject: null,
        at: NOW,
      });

      await expect(ledger.listUnfinished(10)).resolves.toHaveLength(1);

      await ledger.advance(open.id, 'complete', NOW);
      await expect(ledger.listUnfinished(10)).resolves.toEqual([]);
    });

    it('counts attempts, so a stuck erasure is visible without reading a log', async () => {
      const { parent } = await family();
      const ledger = createDeletionRequestRepository(database.db);
      const request = await ledger.open({
        id: ids.next(),
        subjectKind: 'account',
        subjectId: parent.id,
        parentId: parent.id,
        providerSubject: 'supabase-user-2',
        at: NOW,
      });

      await ledger.fail(request.id, 'provider unreachable', NOW);
      await ledger.fail(request.id, 'provider unreachable', NOW);

      await expect(ledger.findById(request.id)).resolves.toMatchObject({
        stage: 'failed',
        attempts: 2,
      });
    });
  });
});
