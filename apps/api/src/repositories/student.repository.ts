import { bandForGrade, type Grade } from '@aria/shared';

import { runQuery } from '@/db/run-query';
import type { Queryable } from '@/db/types';
import { NotFoundError } from '@/errors';
import type { IdGenerator } from '@/lib/ids';
import { toStudent } from '@/mappers/student.mapper';
import type { StudentRow } from '@/mappers/student.mapper';
import { DEFAULT_STUDENT_SETTINGS } from '@/schemas/student-settings.schema';
import type { NewStudent, Student, StudentSettings } from '@/types/student';

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
   * The parent-editable profile (P2H-12). `band` is absent for the same reason it is absent
   * from `NewStudent`: it is derived from `grade`, so a caller cannot set the two at odds.
   */
  update(
    id: string,
    changes: Readonly<{
      displayName?: string;
      grade?: Grade;
      settings?: StudentSettings;
    }>,
  ): Promise<Student | null>;
};

/**
 * Every statement this repository can issue, in one block.
 *
 * Hoisted out of the factory so the SQL is readable as SQL and so the queries a code reviewer
 * has to check are a list rather than a hunt. Column lists are written out: `SELECT *` would
 * make a new column silently reach the mapper.
 */
const COLUMNS = 'id, parent_id, display_name, grade, band, settings, created_at';

const SQL = {
  insert: `INSERT INTO student (id, parent_id, display_name, grade, band, settings)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb)
           RETURNING ${COLUMNS}`,

  findById: `SELECT ${COLUMNS} FROM student WHERE id = $1`,

  // Ordered so the class picker shows siblings the same way between visits; the id tiebreak
  // keeps two children created in one transaction from swapping places.
  listByParentId: `SELECT ${COLUMNS}
                   FROM student
                   WHERE parent_id = $1
                   ORDER BY created_at, id`,

  // COALESCE per column, so one statement serves any subset of the three changes and a NULL
  // parameter means "leave it alone" rather than "erase it". `band` follows `grade` in the
  // same statement, which is what keeps the pair from ever being written disagreeing.
  update: `UPDATE student
           SET display_name = COALESCE($2, display_name),
               grade = COALESCE($3, grade),
               band = COALESCE($4, band),
               settings = COALESCE($5::jsonb, settings)
           WHERE id = $1
           RETURNING ${COLUMNS}`,
} as const;

export type StudentRepositoryDeps = {
  db: Queryable;
  ids: IdGenerator;
};

export function createStudentRepository(deps: StudentRepositoryDeps): StudentRepository {
  const { db, ids } = deps;

  return {
    withDb: (next) => createStudentRepository({ ...deps, db: next }),

    insert: (input) => insert(db, ids, input),
    findById: (id) => findById(db, id),
    update: (id, changes) => update(db, id, changes),

    async requireById(id) {
      const student = await findById(db, id);
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

async function insert(db: Queryable, ids: IdGenerator, input: NewStudent): Promise<Student> {
  const { rows } = await runQuery<StudentRow>({
    db,
    operation: 'student.insert',
    sql: SQL.insert,
    // `band` is derived here rather than accepted, which is what makes the pair in the
    // database consistent by construction instead of by convention.
    params: [
      ids.next(),
      input.parentId,
      input.displayName,
      input.grade,
      bandForGrade(input.grade),
      JSON.stringify(input.settings ?? DEFAULT_STUDENT_SETTINGS),
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

async function update(
  db: Queryable,
  id: string,
  changes: Parameters<StudentRepository['update']>[1],
): Promise<Student | null> {
  const { rows } = await runQuery<StudentRow>({
    db,
    operation: 'student.update',
    sql: SQL.update,
    params: [
      id,
      changes.displayName ?? null,
      changes.grade ?? null,
      changes.grade === undefined ? null : bandForGrade(changes.grade),
      changes.settings === undefined ? null : JSON.stringify(changes.settings),
    ],
  });

  const row = rows[0];
  return row ? toStudent(row) : null;
}
