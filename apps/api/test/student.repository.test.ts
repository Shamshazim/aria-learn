import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { withTransaction } from '@/db';
import { AppError, ERROR_CODES } from '@/errors';
import { sequentialUuids } from '@/lib/ids';
import { createParentRepository } from '@/repositories/parent.repository';
import type { ParentRepository } from '@/repositories/parent.repository';
import { createStudentRepository } from '@/repositories/student.repository';
import type { StudentRepository } from '@/repositories/student.repository';

import { createTestDatabase, shouldSkipDatabaseTests } from './db.harness';

import type { TestDatabase } from './db.harness';

/**
 * Against a real PostgreSQL, because every claim worth making here — that a cascade fires,
 * that a partial unique index bites, that a CHECK constraint becomes a 400 — is a claim about
 * Postgres. A fake would only prove that the fake agrees with itself.
 */
const suite = shouldSkipDatabaseTests() ? describe.skip : describe;

suite('studentRepository', () => {
  let database: TestDatabase;
  let students: StudentRepository;
  let parents: ParentRepository;

  beforeAll(async () => {
    database = await createTestDatabase();
  }, 60_000);

  afterAll(async () => {
    await database.drop();
  });

  beforeEach(async () => {
    await database.truncateAll();
    // A fresh generator per test, so ids are the same sequence in every one of them.
    const ids = sequentialUuids();
    students = createStudentRepository({ db: database.db, ids });
    parents = createParentRepository({ db: database.db, ids });
  });

  async function aParent(email: string | null = 'parent@example.com') {
    return parents.insert({ email, displayName: 'A Parent' });
  }

  describe('insert', () => {
    it('stores a student and returns it as a domain object', async () => {
      const parent = await aParent();

      const student = await students.insert({
        parentId: parent.id,
        displayName: 'Sam',
        grade: '4',
      });

      expect(student).toMatchObject({ parentId: parent.id, displayName: 'Sam', grade: '4' });
      expect(student.createdAt).toBeInstanceOf(Date);
    });

    it('derives the band from the grade rather than accepting one', async () => {
      const parent = await aParent();

      const early = await students.insert({ parentId: parent.id, displayName: 'A', grade: 'TK' });
      const senior = await students.insert({ parentId: parent.id, displayName: 'B', grade: '8' });

      expect(early.band).toBe('early');
      expect(senior.band).toBe('senior');
    });

    it('generates the id through the injected port', async () => {
      const parent = await aParent();

      const student = await students.insert({
        parentId: parent.id,
        displayName: 'Sam',
        grade: '2',
      });

      // Second id from the sequence: the parent took the first.
      expect(student.id).toBe('00000000-0000-4000-8000-000000000002');
    });
  });

  describe('findById', () => {
    it('round-trips a stored student', async () => {
      const parent = await aParent();
      const stored = await students.insert({ parentId: parent.id, displayName: 'Sam', grade: '6' });

      expect(await students.findById(stored.id)).toEqual(stored);
    });

    it('returns null for an id that does not exist', async () => {
      expect(await students.findById('00000000-0000-4000-8000-00000000dead')).toBeNull();
    });

    it('requireById turns the same miss into a 404', async () => {
      await expect(
        students.requireById('00000000-0000-4000-8000-00000000dead'),
      ).rejects.toMatchObject({ status: 404, code: ERROR_CODES.NOT_FOUND });
    });
  });

  describe('listByParentId', () => {
    it('returns one family in a stable order and nobody else', async () => {
      const family = await aParent('one@example.com');
      const other = await parents.insert({ email: 'two@example.com', displayName: 'Other' });

      await students.insert({ parentId: family.id, displayName: 'First', grade: '1' });
      await students.insert({ parentId: family.id, displayName: 'Second', grade: '5' });
      await students.insert({ parentId: other.id, displayName: 'Elsewhere', grade: '3' });

      const listed = await students.listByParentId(family.id);

      expect(listed.map((student) => student.displayName)).toEqual(['First', 'Second']);
    });
  });

  describe('constraint violations become AppErrors', () => {
    it('maps a duplicate name in one family to 409', async () => {
      const parent = await aParent();
      await students.insert({ parentId: parent.id, displayName: 'Sam', grade: '4' });

      // The unique index is on lower(display_name): 'sam' is the same child.
      await expect(
        students.insert({ parentId: parent.id, displayName: 'sam', grade: '4' }),
      ).rejects.toMatchObject({ status: 409, code: ERROR_CODES.CONFLICT });
    });

    it('lets two families each have a child of the same name', async () => {
      const first = await aParent('one@example.com');
      const second = await parents.insert({ email: 'two@example.com', displayName: 'Other' });

      await students.insert({ parentId: first.id, displayName: 'Sam', grade: '4' });

      await expect(
        students.insert({ parentId: second.id, displayName: 'Sam', grade: '4' }),
      ).resolves.toMatchObject({ displayName: 'Sam' });
    });

    it('maps a student with no such parent to 400', async () => {
      await expect(
        students.insert({
          parentId: '00000000-0000-4000-8000-00000000dead',
          displayName: 'Orphan',
          grade: '4',
        }),
      ).rejects.toMatchObject({ status: 400, code: ERROR_CODES.VALIDATION_FAILED });
    });

    it('maps a blank display name to 400', async () => {
      const parent = await aParent();

      await expect(
        students.insert({ parentId: parent.id, displayName: '   ', grade: '4' }),
      ).rejects.toBeInstanceOf(AppError);
    });

    it('never puts the colliding value in the error a client would see', async () => {
      const parent = await aParent();
      await students.insert({ parentId: parent.id, displayName: 'Sam', grade: '4' });

      const error = await students
        .insert({ parentId: parent.id, displayName: 'Sam', grade: '4' })
        .catch((thrown: unknown) => thrown);

      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).safeMessage).not.toContain('Sam');
      expect((error as AppError).message).not.toContain('Sam');
    });
  });

  describe('deleting a parent', () => {
    it('takes their students with it — "delete means delete"', async () => {
      const parent = await aParent();
      const student = await students.insert({
        parentId: parent.id,
        displayName: 'Sam',
        grade: '4',
      });

      expect(await parents.deleteById(parent.id)).toBe(true);

      expect(await students.findById(student.id)).toBeNull();
      expect(await parents.findById(parent.id)).toBeNull();
    });

    it('reports false when there was nothing to delete', async () => {
      expect(await parents.deleteById('00000000-0000-4000-8000-00000000dead')).toBe(false);
    });
  });

  describe('inside a transaction', () => {
    it('rolls back every write when the callback throws', async () => {
      const ids = sequentialUuids();

      await expect(
        withTransaction(database.pool, async (tx) => {
          const parent = await parents.withDb(tx).insert({ email: null, displayName: 'Rolled' });
          await students.withDb(tx).insert({ parentId: parent.id, displayName: 'Sam', grade: '4' });
          throw new Error('deliberate');
        }),
      ).rejects.toThrow('deliberate');

      expect(await students.listByParentId(ids.next())).toEqual([]);
      const { rows } = await database.pool.query<{ count: string }>('SELECT count(*) FROM student');
      expect(rows[0]?.count).toBe('0');
    });

    it('commits every write when it does not', async () => {
      const student = await withTransaction(database.pool, async (tx) => {
        const parent = await parents.withDb(tx).insert({ email: null, displayName: 'Kept' });
        return students.withDb(tx).insert({ parentId: parent.id, displayName: 'Sam', grade: '4' });
      });

      expect(await students.findById(student.id)).not.toBeNull();
    });
  });
});
