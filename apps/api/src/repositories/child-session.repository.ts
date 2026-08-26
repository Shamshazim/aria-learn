import { runQuery } from '@/db/run-query';
import type { Queryable } from '@/db/types';
import { toChildSession, type ChildSessionRow } from '@/mappers/child.mapper';
import type { ChildSessionRecord } from '@/types/auth';

/**
 * Child sessions (P2H-12).
 *
 * A session is a row rather than a self-contained token so that it can be taken back: a
 * parent revoking a device, a withdrawn consent, an idle tablet and a deleted Supabase user
 * all have to end a session that has not expired yet, and none of them can reach into a JWT
 * somebody is already holding.
 *
 * The token itself is never stored. The caller hashes it and passes the hash; a leaked dump
 * of this table is a list of expired-looking rows, not a set of working cookies.
 */
const COLUMNS = `id, student_id, parent_id, issued_at, last_seen_at, expires_at,
  revoked_at, device_label`;

export type ChildSessionRepository = Readonly<{
  withDb(db: Queryable): ChildSessionRepository;
  insert(
    input: Readonly<{
      id: string;
      studentId: string;
      parentId: string;
      tokenHash: string;
      issuedAt: Date;
      expiresAt: Date;
      deviceLabel: string | null;
    }>,
  ): Promise<ChildSessionRecord>;
  /** A live session for this token hash, or null. Revoked and expired rows do not match. */
  findLiveByTokenHash(tokenHash: string, now: Date): Promise<ChildSessionRecord | null>;
  /** Idle expiry is server-side, so the last-seen stamp is written here and nowhere else. */
  touch(id: string, at: Date): Promise<void>;
  /** Rotation: the same row, a new secret, and the idle clock reset. */
  rotate(id: string, tokenHash: string, at: Date): Promise<ChildSessionRecord | null>;
  revoke(id: string, at: Date): Promise<boolean>;
  revokeAllForParent(parentId: string, at: Date): Promise<readonly ChildSessionRecord[]>;
  revokeAllForStudent(studentId: string, at: Date): Promise<readonly ChildSessionRecord[]>;
  /** Everything the sweeper has to end: past its idle deadline or past its absolute one. */
  findExpired(now: Date, idleCutoff: Date, limit: number): Promise<readonly ChildSessionRecord[]>;
}>;

const SQL = {
  insert: `INSERT INTO child_session
             (id, student_id, parent_id, token_hash, issued_at, last_seen_at,
              expires_at, device_label)
           VALUES ($1, $2, $3, $4, $5, $5, $6, $7)
           RETURNING ${COLUMNS}`,

  findLiveByTokenHash: `SELECT ${COLUMNS} FROM child_session
                        WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > $2`,

  touch: 'UPDATE child_session SET last_seen_at = $2 WHERE id = $1 AND revoked_at IS NULL',

  rotate: `UPDATE child_session SET token_hash = $2, last_seen_at = $3
           WHERE id = $1 AND revoked_at IS NULL AND expires_at > $3
           RETURNING ${COLUMNS}`,

  revoke: 'UPDATE child_session SET revoked_at = $2 WHERE id = $1 AND revoked_at IS NULL',

  revokeAllForParent: `UPDATE child_session SET revoked_at = $2
                       WHERE parent_id = $1 AND revoked_at IS NULL
                       RETURNING ${COLUMNS}`,

  revokeAllForStudent: `UPDATE child_session SET revoked_at = $2
                        WHERE student_id = $1 AND revoked_at IS NULL
                        RETURNING ${COLUMNS}`,

  findExpired: `SELECT ${COLUMNS} FROM child_session
                WHERE revoked_at IS NULL AND (expires_at <= $1 OR last_seen_at <= $2)
                ORDER BY last_seen_at LIMIT $3`,
} as const;

export function createChildSessionRepository(db: Queryable): ChildSessionRepository {
  const one = async (
    operation: string,
    sql: string,
    params: readonly unknown[],
  ): Promise<ChildSessionRecord | null> => {
    const { rows } = await runQuery<ChildSessionRow>({ db, operation, sql, params: [...params] });
    const row = rows[0];
    return row ? toChildSession(row) : null;
  };

  const many = async (
    operation: string,
    sql: string,
    params: readonly unknown[],
  ): Promise<readonly ChildSessionRecord[]> => {
    const { rows } = await runQuery<ChildSessionRow>({ db, operation, sql, params: [...params] });
    return rows.map(toChildSession);
  };

  return {
    withDb: (next) => createChildSessionRepository(next),

    insert: async (input) => insert(one, input),

    findLiveByTokenHash: (tokenHash, now) =>
      one('childSession.findLiveByTokenHash', SQL.findLiveByTokenHash, [tokenHash, now]),

    touch: async (id, at) => {
      await execute(db, 'childSession.touch', SQL.touch, [id, at]);
    },

    rotate: (id, tokenHash, at) => one('childSession.rotate', SQL.rotate, [id, tokenHash, at]),

    revoke: async (id, at) => (await execute(db, 'childSession.revoke', SQL.revoke, [id, at])) > 0,

    revokeAllForParent: (parentId, at) =>
      many('childSession.revokeAllForParent', SQL.revokeAllForParent, [parentId, at]),

    revokeAllForStudent: (studentId, at) =>
      many('childSession.revokeAllForStudent', SQL.revokeAllForStudent, [studentId, at]),

    findExpired: (now, idleCutoff, limit) =>
      many('childSession.findExpired', SQL.findExpired, [now, idleCutoff, limit]),
  };
}

type FindOne = (
  operation: string,
  sql: string,
  params: readonly unknown[],
) => Promise<ChildSessionRecord | null>;

async function insert(
  one: FindOne,
  input: Parameters<ChildSessionRepository['insert']>[0],
): Promise<ChildSessionRecord> {
  const session = await one('childSession.insert', SQL.insert, [
    input.id,
    input.studentId,
    input.parentId,
    input.tokenHash,
    input.issuedAt,
    input.expiresAt,
    input.deviceLabel,
  ]);
  if (session === null) throw new Error('childSession.insert returned no row');
  return session;
}

/** How many rows a write touched, for the two callers that care whether it touched any. */
async function execute(
  db: Queryable,
  operation: string,
  sql: string,
  params: readonly unknown[],
): Promise<number> {
  const { rowCount } = await runQuery({ db, operation, sql, params: [...params] });
  return rowCount ?? 0;
}
