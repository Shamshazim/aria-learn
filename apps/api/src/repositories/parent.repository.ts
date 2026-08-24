import { runQuery } from '@/db/run-query';
import type { Queryable } from '@/db/types';
import { NotFoundError } from '@/errors';
import type { IdGenerator } from '@/lib/ids';
import { toParent } from '@/mappers/parent.mapper';
import type { ParentRow } from '@/mappers/parent.mapper';
import type { NewParent, Parent } from '@/types/parent';

/**
 * Parents, following the same shape as `student.repository.ts`.
 *
 * It exists in this ticket for one reason: a student cannot be stored without a parent to
 * belong to, and proving that deletion cascades needs a parent to delete. Nothing here
 * touches credentials — that is P0-26's decision to make.
 */
export type ParentRepository = {
  withDb(db: Queryable): ParentRepository;
  insert(input: NewParent): Promise<Parent>;
  findById(id: string): Promise<Parent | null>;
  findByEmail(email: string): Promise<Parent | null>;
  /**
   * Erasure. The `ON DELETE CASCADE` on `student.parent_id` means this takes the children
   * with it — master-plan.md §12.9, "delete means delete".
   */
  deleteById(id: string): Promise<boolean>;
};

/** Every statement this repository can issue, in one block — see `student.repository.ts`. */
const SQL = {
  insert: `INSERT INTO parent (id, email, display_name)
           VALUES ($1, $2, $3)
           RETURNING id, email, display_name, created_at`,

  findById: 'SELECT id, email, display_name, created_at FROM parent WHERE id = $1',

  // `email` is CITEXT, so this comparison is case-insensitive in the column type rather than
  // through a lower() call every future query would have to remember.
  findByEmail: 'SELECT id, email, display_name, created_at FROM parent WHERE email = $1',

  deleteById: 'DELETE FROM parent WHERE id = $1',
} as const;

export type ParentRepositoryDeps = {
  db: Queryable;
  ids: IdGenerator;
};

export function createParentRepository(deps: ParentRepositoryDeps): ParentRepository {
  const { db, ids } = deps;

  return {
    withDb: (next) => createParentRepository({ ...deps, db: next }),

    async insert(input) {
      const { rows } = await runQuery<ParentRow>({
        db,
        operation: 'parent.insert',
        sql: SQL.insert,
        params: [ids.next(), input.email, input.displayName],
      });

      const row = rows[0];
      if (!row) throw new NotFoundError('parent.insert returned no row');
      return toParent(row);
    },

    async findById(id) {
      const { rows } = await runQuery<ParentRow>({
        db,
        operation: 'parent.findById',
        sql: SQL.findById,
        params: [id],
      });

      const row = rows[0];
      return row ? toParent(row) : null;
    },

    async findByEmail(email) {
      const { rows } = await runQuery<ParentRow>({
        db,
        operation: 'parent.findByEmail',
        sql: SQL.findByEmail,
        params: [email],
      });

      const row = rows[0];
      return row ? toParent(row) : null;
    },

    async deleteById(id) {
      const { rowCount } = await runQuery({
        db,
        operation: 'parent.deleteById',
        sql: SQL.deleteById,
        params: [id],
      });

      return (rowCount ?? 0) > 0;
    },
  };
}
