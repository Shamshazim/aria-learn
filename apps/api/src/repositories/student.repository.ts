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
};

/**
 * Every statement this repository can issue, in one block.
 *
 * Hoisted out of the factory so the SQL is readable as SQL and so the queries a code reviewer
 * has to check are a list rather than a hunt. Column lists are written out: `SELECT *` would
 * make a new column silently reach the mapper.
 */
const SQL = {
  insert: `INSERT INTO student (id, parent_id, display_name, grade, band)
           VALUES ($1, $2, $3, $4, $5)
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
} as const;

export type StudentRepositoryDeps = {
  db: Queryable;
  ids: IdGenerator;
};

export function createStudentRepository(deps: StudentRepositoryDeps): StudentRepository {
  const { db, ids } = deps;

  return {
    withDb: (next) => createStudentRepository({ ...deps, db: next }),

    async insert(input) {
      const { rows } = await runQuery<StudentRow>({
        db,
        operation: 'student.insert',
        sql: `INSERT INTO student (id, parent_id, display_name, grade, band)
              VALUES ($1, $2, $3, $4, $5)
              RETURNING id, parent_id, display_name, grade, band, created_at`,
        // `band` is derived here rather than accepted, which is what makes the pair in the
        // database consistent by construction instead of by convention.
        params: [
          ids.next(),
          input.parentId,
          input.displayName,
          input.grade,
          bandForGrade(input.grade),
        ],
      });

      const row = rows[0];
      if (!row) throw new NotFoundError('student.insert returned no row');
      return toStudent(row);
    },

    async findById(id) {
      const { rows } = await runQuery<StudentRow>({
        db,
        operation: 'student.findById',
        sql: SQL.findById,
        params: [id],
      });

      const row = rows[0];
      return row ? toStudent(row) : null;
    },

    async requireById(id) {
      const student = await this.findById(id);
      if (!student) throw new NotFoundError(`student ${id} not found`);
      return student;
    },

    async listByParentId(parentId) {
      const { rows } = await runQuery<StudentRow>({
        db,
        operation: 'student.listByParentId',
        sql: SQL.listByParentId,
        params: [parentId],
      });

      return rows.map(toStudent);
    },
  };
}
