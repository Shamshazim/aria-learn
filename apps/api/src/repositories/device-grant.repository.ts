import { runQuery } from '@/db/run-query';
import type { Queryable } from '@/db/types';
import { toDeviceGrant, type DeviceGrantRow } from '@/mappers/parent-access.mapper';
import type { DeviceGrant, DeviceGrantSummary } from '@/types/parent-access';

/**
 * Devices a parent has trusted, and the children each may open (P0-28).
 *
 * The secret is never stored and never returned. The caller hashes it and passes the hash;
 * what comes back out of this file is a grant with a label and a date, which is all a revoke
 * list needs and all a leaked dump would give anybody.
 */
const COLUMNS = `id, parent_id, label, created_at, last_seen_at, revoked_at`;

export type NewDeviceGrant = Readonly<{
  id: string;
  parentId: string;
  label: string;
  secretHash: string;
  studentIds: readonly string[];
  at: Date;
}>;

export type DeviceGrantRepository = Readonly<{
  withDb(db: Queryable): DeviceGrantRepository;
  /** The grant and its scope, in one transaction: a grant scoped to nobody opens nothing. */
  insert(input: NewDeviceGrant): Promise<DeviceGrant>;
  /**
   * A live grant for this secret hash, or null. Revoked grants do not match.
   *
   * No `now`: a grant has no expiry. It lasts until a parent takes it back, because a tablet
   * that stopped working on a Tuesday for no reason a child can see is worse than one a
   * parent has to revoke deliberately.
   */
  findActiveBySecretHash(secretHash: string): Promise<DeviceGrant | null>;
  /** Whether this grant may open this child. Asked on every child sign-in from a device. */
  permits(grantId: string, studentId: string): Promise<boolean>;
  listByParent(parentId: string): Promise<readonly DeviceGrantSummary[]>;
  touch(id: string, at: Date): Promise<void>;
  /** Scoped to the parent in the statement, so no caller can forget to check ownership. */
  revoke(id: string, parentId: string, at: Date): Promise<DeviceGrant | null>;
}>;

const SQL = {
  insert: `INSERT INTO device_grant (id, parent_id, label, secret_hash, created_at)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING ${COLUMNS}`,

  // One statement for the whole scope: `unnest` keeps a grant from ever existing with half
  // its children attached, without a second round trip per child.
  insertScope: `INSERT INTO device_grant_student (grant_id, student_id)
                SELECT $1, id FROM student
                WHERE id = ANY($2::uuid[]) AND parent_id = $3`,

  findActiveBySecretHash: `SELECT ${COLUMNS} FROM device_grant
                           WHERE secret_hash = $1 AND revoked_at IS NULL`,

  permits: `SELECT 1 FROM device_grant_student WHERE grant_id = $1 AND student_id = $2`,

  listByParent: `SELECT g.id, g.parent_id, g.label, g.created_at, g.last_seen_at, g.revoked_at,
                        COALESCE(
                          array_agg(s.student_id ORDER BY s.student_id)
                            FILTER (WHERE s.student_id IS NOT NULL),
                          '{}'
                        ) AS student_ids
                 FROM device_grant g
                 LEFT JOIN device_grant_student s ON s.grant_id = g.id
                 WHERE g.parent_id = $1 AND g.revoked_at IS NULL
                 GROUP BY g.id
                 ORDER BY g.created_at, g.id`,

  touch: `UPDATE device_grant SET last_seen_at = $2 WHERE id = $1`,

  revoke: `UPDATE device_grant SET revoked_at = $3
           WHERE id = $1 AND parent_id = $2 AND revoked_at IS NULL
           RETURNING ${COLUMNS}`,
} as const;

export function createDeviceGrantRepository(db: Queryable): DeviceGrantRepository {
  return {
    withDb: createDeviceGrantRepository,
    insert: (input) => insert(db, input),
    findActiveBySecretHash: (secretHash) => findActive(db, secretHash),
    permits: (grantId, studentId) => permits(db, grantId, studentId),
    listByParent: (parentId) => listByParent(db, parentId),
    touch: async (id, at) => {
      await runQuery({ db, operation: 'deviceGrant.touch', sql: SQL.touch, params: [id, at] });
    },
    revoke: (id, parentId, at) => revoke(db, id, parentId, at),
  };
}

async function insert(db: Queryable, input: NewDeviceGrant): Promise<DeviceGrant> {
  const { rows } = await runQuery<DeviceGrantRow>({
    db,
    operation: 'deviceGrant.insert',
    sql: SQL.insert,
    params: [input.id, input.parentId, input.label, input.secretHash, input.at],
  });

  const row = rows[0];
  if (row === undefined) throw new Error('device_grant.insert returned no row');

  // `parent_id` in the scope statement too: a parent cannot scope a device to a child who is
  // not theirs, whatever the request body said.
  await runQuery({
    db,
    operation: 'deviceGrant.insertScope',
    sql: SQL.insertScope,
    params: [input.id, [...input.studentIds], input.parentId],
  });

  return toDeviceGrant(row);
}

async function findActive(db: Queryable, secretHash: string): Promise<DeviceGrant | null> {
  const { rows } = await runQuery<DeviceGrantRow>({
    db,
    operation: 'deviceGrant.findActiveBySecretHash',
    sql: SQL.findActiveBySecretHash,
    params: [secretHash],
  });

  const row = rows[0];
  return row === undefined ? null : toDeviceGrant(row);
}

async function permits(db: Queryable, grantId: string, studentId: string): Promise<boolean> {
  const { rowCount } = await runQuery({
    db,
    operation: 'deviceGrant.permits',
    sql: SQL.permits,
    params: [grantId, studentId],
  });

  return (rowCount ?? 0) > 0;
}

async function listByParent(
  db: Queryable,
  parentId: string,
): Promise<readonly DeviceGrantSummary[]> {
  const { rows } = await runQuery<DeviceGrantRow & { student_ids: string[] }>({
    db,
    operation: 'deviceGrant.listByParent',
    sql: SQL.listByParent,
    params: [parentId],
  });

  return rows.map((row) => ({ ...toDeviceGrant(row), studentIds: row.student_ids }));
}

async function revoke(
  db: Queryable,
  id: string,
  parentId: string,
  at: Date,
): Promise<DeviceGrant | null> {
  const { rows } = await runQuery<DeviceGrantRow>({
    db,
    operation: 'deviceGrant.revoke',
    sql: SQL.revoke,
    params: [id, parentId, at],
  });

  const row = rows[0];
  return row === undefined ? null : toDeviceGrant(row);
}
