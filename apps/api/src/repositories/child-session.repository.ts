import { runQuery } from '@/db/run-query';
import type { Queryable } from '@/db/types';
import { NotFoundError } from '@/errors';
import type { IdGenerator } from '@/lib/ids';
import { toChildSession } from '@/mappers/device-access.mapper';
import type { ChildSessionRow } from '@/mappers/device-access.mapper';
import type { ChildSession } from '@/types/device-access';

/**
 * A child's live session on an authorised device.
 *
 * `findLiveByTokenHash` is the statement every child request runs, and the reason it takes the
 * grant with it: a parent who revokes a device must lock the child out on the next request,
 * not when the session happens to expire. The revocation and the lifetime are both in the
 * predicate, so there is no path that reads one and forgets the other.
 */
export type LiveChildSession = {
  session: ChildSession;
  /** Denormalised from the grant, so authorisation needs no second round trip. */
  parentId: string;
};

export type ChildSessionRepository = {
  withDb(db: Queryable): ChildSessionRepository;
  /**
   * `at` is passed rather than left to the column default. The idle window is measured from
   * `last_seen_at`, so a row stamped by the database clock and compared against the injected
   * one would make the lifetime depend on the skew between two clocks (CODE-STANDARDS §4).
   */
  insert(input: {
    grantId: string;
    studentId: string;
    tokenHash: string;
    at: Date;
    absoluteExpiresAt: Date;
  }): Promise<ChildSession>;
  /** Live means: not revoked, its grant not revoked, inside both windows. */
  findLiveByTokenHash(
    tokenHash: string,
    at: Date,
    idleMs: number,
  ): Promise<LiveChildSession | null>;
  touch(id: string, at: Date): Promise<void>;
  revoke(id: string, at: Date): Promise<boolean>;
  /** Every session opened on one device. What revoking that device ends, and nothing more. */
  revokeAllForGrant(grantId: string, at: Date): Promise<number>;
  /** Every session for one child, on every device. What changing their secret ends. */
  revokeAllForStudent(studentId: string, at: Date): Promise<number>;
  countLiveForStudent(studentId: string, at: Date, idleMs: number): Promise<number>;
};

const COLUMNS = `c.id, c.grant_id, c.student_id, c.created_at, c.last_seen_at, c.absolute_expires_at, c.revoked_at`;

// The idle window is computed rather than stored: changing the policy must not require
// rewriting rows, and a stored deadline would silently keep the old policy for existing ones.
const LIVE_PREDICATE = `c.revoked_at IS NULL
                        AND g.revoked_at IS NULL
                        AND c.absolute_expires_at > $2
                        AND c.last_seen_at > $2::timestamptz - make_interval(secs => $3::double precision)`;

/** Every statement this repository can issue, in one block — see `student.repository.ts`. */
const SQL = {
  insert: `INSERT INTO child_session
             (id, grant_id, student_id, token_hash, created_at, last_seen_at, absolute_expires_at)
           VALUES ($1, $2, $3, $4, $5, $5, $6)
           RETURNING id, grant_id, student_id, created_at, last_seen_at, absolute_expires_at, revoked_at`,

  findLiveByTokenHash: `SELECT ${COLUMNS}, g.parent_id
                        FROM child_session c
                        JOIN device_grant g ON g.id = c.grant_id
                        WHERE c.token_hash = $1 AND ${LIVE_PREDICATE}`,

  touch: `UPDATE child_session SET last_seen_at = $2 WHERE id = $1 AND revoked_at IS NULL`,

  revoke: `UPDATE child_session SET revoked_at = $2 WHERE id = $1 AND revoked_at IS NULL`,

  revokeAllForGrant: `UPDATE child_session SET revoked_at = $2
                      WHERE grant_id = $1 AND revoked_at IS NULL`,

  revokeAllForStudent: `UPDATE child_session SET revoked_at = $2
                        WHERE student_id = $1 AND revoked_at IS NULL`,

  countLiveForStudent: `SELECT count(*)::int AS live
                        FROM child_session c
                        JOIN device_grant g ON g.id = c.grant_id
                        WHERE c.student_id = $1 AND ${LIVE_PREDICATE}`,
} as const;

export type ChildSessionRepositoryDeps = {
  db: Queryable;
  ids: IdGenerator;
};

export function createChildSessionRepository(
  deps: ChildSessionRepositoryDeps,
): ChildSessionRepository {
  const { db } = deps;

  return {
    withDb: (next) => createChildSessionRepository({ ...deps, db: next }),
    insert: (input) => insert(deps, input),
    findLiveByTokenHash: (tokenHash, at, idleMs) => findLive(db, tokenHash, at, idleMs),
    touch: async (id, at) => {
      await execute(db, 'childSession.touch', SQL.touch, [id, at]);
    },
    revoke: async (id, at) => (await execute(db, 'childSession.revoke', SQL.revoke, [id, at])) > 0,
    revokeAllForGrant: (grantId, at) =>
      execute(db, 'childSession.revokeAllForGrant', SQL.revokeAllForGrant, [grantId, at]),
    revokeAllForStudent: (studentId, at) =>
      execute(db, 'childSession.revokeAllForStudent', SQL.revokeAllForStudent, [studentId, at]),
    countLiveForStudent: (studentId, at, idleMs) => countLive(db, studentId, at, idleMs),
  };
}

async function insert(
  deps: ChildSessionRepositoryDeps,
  input: {
    grantId: string;
    studentId: string;
    tokenHash: string;
    at: Date;
    absoluteExpiresAt: Date;
  },
): Promise<ChildSession> {
  const { rows } = await runQuery<ChildSessionRow>({
    db: deps.db,
    operation: 'childSession.insert',
    sql: SQL.insert,
    params: [
      deps.ids.next(),
      input.grantId,
      input.studentId,
      input.tokenHash,
      input.at,
      input.absoluteExpiresAt,
    ],
  });

  const row = rows[0];
  if (!row) throw new NotFoundError('childSession.insert returned no row');
  return toChildSession(row);
}

async function findLive(
  db: Queryable,
  tokenHash: string,
  at: Date,
  idleMs: number,
): Promise<LiveChildSession | null> {
  const { rows } = await runQuery<ChildSessionRow & { parent_id: string }>({
    db,
    operation: 'childSession.findLiveByTokenHash',
    sql: SQL.findLiveByTokenHash,
    // Seconds, because `make_interval` takes them and the policy is expressed in milliseconds.
    params: [tokenHash, at, idleMs / 1000],
  });

  const row = rows[0];
  return row ? { session: toChildSession(row), parentId: row.parent_id } : null;
}

async function countLive(
  db: Queryable,
  studentId: string,
  at: Date,
  idleMs: number,
): Promise<number> {
  const { rows } = await runQuery<{ live: number }>({
    db,
    operation: 'childSession.countLiveForStudent',
    sql: SQL.countLiveForStudent,
    params: [studentId, at, idleMs / 1000],
  });
  return rows[0]?.live ?? 0;
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
