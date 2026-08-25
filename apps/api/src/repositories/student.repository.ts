import { bandForGrade } from '@aria/shared';

import { runQuery } from '@/db/run-query';
import type { Queryable } from '@/db/types';
import { NotFoundError } from '@/errors';
import type { IdGenerator } from '@/lib/ids';
import { toStudent } from '@/mappers/student.mapper';
import type { StudentRow } from '@/mappers/student.mapper';
import type { NewStudent, Student } from '@/types/student';

/**
 * The pattern every later repository copies.
 *
 * Four things make it that pattern:
 *   * It owns its SQL. No query exists outside `repositories/` and `db/`, so the set of
 *     statements this service can issue is enumerable by reading one directory.
 *   * It takes a `Queryable`, not a `Pool`. The same repository runs inside a transaction and
 *     outside one, and `withDb` is how a caller re-points it at a transaction's client.
 *   * It generates its own ids through the injected `ids` port, so a test can predict them.
 *   * It returns domain types. A `StudentRow` never leaves this file.
 */
export type StudentRepository = {
  /** The same repository bound to another connection — a transaction's client, in practice. */
  withDb(db: Queryable): StudentRepository;
  insert(input: NewStudent): Promise<Student>;
  findById(id: string): Promise<Student | null>;
  /** For callers whose next line has no meaning without the student. */
  requireById(id: string): Promise<Student>;
  listByParentId(parentId: string): Promise<readonly Student[]>;
  /**
   * Erasure of one child. The cascades on every table that references `student` are what make
   * this "delete means delete" for that child and only that child — a sibling's rows are
   * reached from a different student id and are untouched (master-plan.md §12.9).
   */
  deleteById(id: string, parentId: string): Promise<boolean>;
  /**
   * The same erasure without the parent scope, for the deletion ledger's replay path only.
   * Authorisation was checked and *recorded* when the ledger row was written; the replay is
   * finishing an authorised deletion, and by then the parent row it was scoped to may itself
   * be gone. Nothing reachable from a request calls this.
   */
  forceDeleteById(id: string): Promise<boolean>;
};

/**
 * Every statement this repository can issue, in one block.
 *
 * Hoisted out of the factory so the SQL is readable as SQL and so the queries a code reviewer
 * has to check are a list rather than a hunt. Column lists are written out: `SELECT *` would
 * make a new column silently reach the mapper.
 */
const SQL = {
  insert: `INSERT INTO student (id, parent_id, display_name, grade, band, avatar_key, picture_secret_hash)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, parent_id, display_name, grade, band, created_at`,

  findById: `SELECT id, parent_id, display_name, grade, band, created_at
             FROM student
             WHERE id = $1`,

  // Ordered so the class picker shows siblings the same way between visits; the id tiebreak
  // keeps two children created in one transaction from swapping places.
  listByParentId: `SELECT id, parent_id, display_name, grade, band, created_at
                   FROM student
                   WHERE parent_id = $1
                   ORDER BY created_at, id`,

  // `parent_id` in the predicate, not only the id: a parent may only delete their own child,
  // and putting that in the statement means no caller can forget to check it.
  deleteById: `DELETE FROM student WHERE id = $1 AND parent_id = $2`,

  forceDeleteById: `DELETE FROM student WHERE id = $1`,
} as const;

export type StudentRepositoryDeps = {
  db: Queryable;
  ids: IdGenerator;
};

export function createStudentRepository(deps: StudentRepositoryDeps): StudentRepository {
  const { db } = deps;

  const repository: StudentRepository = {
    withDb: (next) => createStudentRepository({ ...deps, db: next }),
    insert: (input) => insert(deps, input),
    findById: (id) => findById(db, id),
    requireById: async (id) => {
      const student = await repository.findById(id);
      if (!student) throw new NotFoundError(`student ${id} not found`);
      return student;
    },
    listByParentId: (parentId) => listByParentId(db, parentId),
    deleteById: async (id, parentId) =>
      (await execute(db, 'student.deleteById', SQL.deleteById, [id, parentId])) > 0,
    forceDeleteById: async (id) =>
      (await execute(db, 'student.forceDeleteById', SQL.forceDeleteById, [id])) > 0,
  };

  return repository;
}

async function insert(deps: StudentRepositoryDeps, input: NewStudent): Promise<Student> {
  const { rows } = await runQuery<StudentRow>({
    db: deps.db,
    operation: 'student.insert',
    sql: SQL.insert,
    // `band` is derived here rather than accepted, which is what makes the pair in the
    // database consistent by construction instead of by convention.
    params: [
      deps.ids.next(),
      input.parentId,
      input.displayName,
      input.grade,
      bandForGrade(input.grade),
      input.avatarKey ?? null,
      input.pictureSecretHash ?? null,
    ],
  });

  const row = rows[0];
  if (!row) throw new NotFoundError('student.insert returned no row');
  return toStudent(row);
}

async function findById(db: Queryable, id: string): Promise<Student | null> {
  const { rows } = await runQuery<StudentRow>({
    db,
    operation: 'student.findById',
    sql: SQL.findById,
    params: [id],
  });

  const row = rows[0];
  return row ? toStudent(row) : null;
}

async function listByParentId(db: Queryable, parentId: string): Promise<readonly Student[]> {
  const { rows } = await runQuery<StudentRow>({
    db,
    operation: 'student.listByParentId',
    sql: SQL.listByParentId,
    params: [parentId],
  });

  return rows.map(toStudent);
}

/** Statements whose only interesting result is how many rows they changed. */
async function execute(
  db: Queryable,
  operation: string,
  sql: string,
  params: readonly unknown[],
): Promise<number> {
  const { rowCount } = await runQuery({ db, operation, sql, params });
  return rowCount ?? 0;
}
