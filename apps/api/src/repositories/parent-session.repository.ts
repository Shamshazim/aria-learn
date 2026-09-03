import { runQuery } from '@/db/run-query';
import type { Queryable } from '@/db/types';
import { toParentSession, type ParentSessionRow } from '@/mappers/parent-access.mapper';
import type { ParentSessionRecord } from '@/types/parent-access';

/**
 * A parent's session, as a row (P0-28).
 *
 * The vendor still mints the token and still says who the parent is. This table says for how
 * long, and is the only thing that can answer "sign me out everywhere" — a JWT already in
 * somebody's hands cannot be recalled, and a row can.
 */
const COLUMNS = `id, parent_id, provider_session_id, issued_at, last_seen_at,
  expires_at, revoked_at`;

export type ParentSessionRepository = Readonly<{
  withDb(db: Queryable): ParentSessionRepository;
  /**
   * The row for this vendor session, creating it on first sight.
   *
   * Upsert rather than find-then-insert: two tabs making their first request at the same
   * moment would otherwise race for the same unique index, and one of them would 500 on a
   * request that did nothing wrong.
   */
  upsert(
    input: Readonly<{
      id: string;
      parentId: string;
      providerSessionId: string;
      at: Date;
      expiresAt: Date;
    }>,
  ): Promise<ParentSessionRecord>;
  touch(id: string, at: Date): Promise<void>;
  revoke(id: string, at: Date): Promise<boolean>;
  /** Sign out everywhere. Returns how many sessions that was. */
  revokeAllForParent(parentId: string, at: Date): Promise<number>;
}>;

const SQL = {
  // `DO UPDATE` rather than `DO NOTHING`, because only `DO UPDATE` returns the existing row
  // on a conflict — and the caller needs that row to decide anything at all.
  //
  // The assignment is deliberately a no-op. Writing `EXCLUDED.last_seen_at` here would stamp
  // the row with the current time *before* the caller compares against it, and the idle
  // window would never fire: every session would look like it was used a moment ago, because
  // this statement had just said so. Advancing the stamp is `touch`'s job, after the check.
  upsert: `INSERT INTO parent_session
             (id, parent_id, provider_session_id, issued_at, last_seen_at, expires_at)
           VALUES ($1, $2, $3, $4, $4, $5)
           ON CONFLICT (provider_session_id) DO UPDATE
             SET last_seen_at = parent_session.last_seen_at
           RETURNING ${COLUMNS}`,

  touch: `UPDATE parent_session SET last_seen_at = $2 WHERE id = $1`,

  revoke: `UPDATE parent_session SET revoked_at = $2
           WHERE id = $1 AND revoked_at IS NULL`,

  revokeAllForParent: `UPDATE parent_session SET revoked_at = $2
                       WHERE parent_id = $1 AND revoked_at IS NULL`,
} as const;

export function createParentSessionRepository(db: Queryable): ParentSessionRepository {
  return {
    withDb: createParentSessionRepository,
    upsert: (input) => upsert(db, input),
    touch: async (id, at) => {
      await runQuery({ db, operation: 'parentSession.touch', sql: SQL.touch, params: [id, at] });
    },
    revoke: async (id, at) => (await execute(db, 'parentSession.revoke', SQL.revoke, [id, at])) > 0,
    revokeAllForParent: (parentId, at) =>
      execute(db, 'parentSession.revokeAllForParent', SQL.revokeAllForParent, [parentId, at]),
  };
}

async function upsert(
  db: Queryable,
  input: Readonly<{
    id: string;
    parentId: string;
    providerSessionId: string;
    at: Date;
    expiresAt: Date;
  }>,
): Promise<ParentSessionRecord> {
  const { rows } = await runQuery<ParentSessionRow>({
    db,
    operation: 'parentSession.upsert',
    sql: SQL.upsert,
    params: [input.id, input.parentId, input.providerSessionId, input.at, input.expiresAt],
  });

  const row = rows[0];
  if (row === undefined) throw new Error('parent_session.upsert returned no row');
  return toParentSession(row);
}

async function execute(
  db: Queryable,
  operation: string,
  sql: string,
  params: readonly unknown[],
): Promise<number> {
  const { rowCount } = await runQuery({ db, operation, sql, params });
  return rowCount ?? 0;
}
