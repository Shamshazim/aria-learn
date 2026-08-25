import { runQuery } from '@/db/run-query';
import type { Queryable } from '@/db/types';
import { NotFoundError } from '@/errors';
import type { IdGenerator } from '@/lib/ids';
import { toChildProfileSummary, toDeviceGrant } from '@/mappers/device-access.mapper';
import type { ChildProfileRow, DeviceGrantRow } from '@/mappers/device-access.mapper';
import type { ChildProfileSummary, DeviceGrant } from '@/types/device-access';

/**
 * Devices a parent has authorised, and the children each may open.
 *
 * The scoping table is the whole of the authorisation, which is what keeps one child's device
 * off a sibling's session: `listProfiles` and `permits` both join through it, so a device with
 * no row for a student cannot see that student's picture, let alone open their session.
 *
 * The secret is never returned. It is written as a hash and read only as a lookup key.
 */
export type DeviceGrantRepository = {
  withDb(db: Queryable): DeviceGrantRepository;
  insert(input: {
    parentId: string;
    label: string;
    secretHash: string;
    studentIds: readonly string[];
  }): Promise<DeviceGrant>;
  /** The sign-in path: a presented device secret, hashed, resolved to a live grant. */
  findActiveBySecretHash(secretHash: string, at: Date): Promise<DeviceGrant | null>;
  findById(id: string): Promise<DeviceGrant | null>;
  listByParentId(parentId: string): Promise<readonly DeviceGrant[]>;
  /** The picker: nickname and picture only, for the children this device may open. */
  listProfiles(grantId: string): Promise<readonly ChildProfileSummary[]>;
  permits(grantId: string, studentId: string): Promise<boolean>;
  touch(id: string, at: Date): Promise<void>;
  revoke(id: string, parentId: string, at: Date): Promise<boolean>;
  revokeAllForParent(parentId: string, at: Date): Promise<number>;
};

const COLUMNS = `g.id, g.parent_id, g.label, g.created_at, g.last_seen_at, g.revoked_at`;

// The scoped children come back with the grant rather than in a second query: a parent's
// device list is one round trip however many devices they have.
const WITH_STUDENTS = `${COLUMNS},
         COALESCE(
           (SELECT array_agg(s.student_id ORDER BY s.student_id)
            FROM device_grant_student s WHERE s.grant_id = g.id),
           '{}'
         ) AS student_ids`;

/** Every statement this repository can issue, in one block — see `student.repository.ts`. */
const SQL = {
  insert: `INSERT INTO device_grant (id, parent_id, label, secret_hash)
           VALUES ($1, $2, $3, $4)
           RETURNING id, parent_id, label, created_at, last_seen_at, revoked_at`,

  // One statement for any number of children: `unnest` turns the id array into rows, and the
  // join to `student` is what refuses a child who is not this parent's.
  scope: `INSERT INTO device_grant_student (grant_id, student_id)
          SELECT $1, s.id FROM student s
          WHERE s.id = ANY($2::uuid[]) AND s.parent_id = $3
          ON CONFLICT DO NOTHING`,

  findActiveBySecretHash: `SELECT ${WITH_STUDENTS} FROM device_grant g
                           WHERE g.secret_hash = $1 AND g.revoked_at IS NULL`,

  findById: `SELECT ${WITH_STUDENTS} FROM device_grant g WHERE g.id = $1`,

  listByParentId: `SELECT ${WITH_STUDENTS} FROM device_grant g
                   WHERE g.parent_id = $1
                   ORDER BY g.created_at DESC, g.id`,

  listProfiles: `SELECT st.id, st.display_name, st.avatar_key
                 FROM device_grant_student dgs
                 JOIN student st ON st.id = dgs.student_id
                 WHERE dgs.grant_id = $1
                 ORDER BY st.created_at, st.id`,

  permits: `SELECT EXISTS (
              SELECT 1 FROM device_grant_student WHERE grant_id = $1 AND student_id = $2
            ) AS permitted`,

  touch: `UPDATE device_grant SET last_seen_at = $2 WHERE id = $1 AND revoked_at IS NULL`,

  // `parent_id` in the predicate, not just the id: a parent may only revoke their own device,
  // and saying so in SQL means no caller can forget to check.
  revoke: `UPDATE device_grant SET revoked_at = $3
           WHERE id = $1 AND parent_id = $2 AND revoked_at IS NULL`,

  revokeAllForParent: `UPDATE device_grant SET revoked_at = $2
                       WHERE parent_id = $1 AND revoked_at IS NULL`,
} as const;

export type DeviceGrantRepositoryDeps = {
  db: Queryable;
  ids: IdGenerator;
};

export function createDeviceGrantRepository(
  deps: DeviceGrantRepositoryDeps,
): DeviceGrantRepository {
  const { db } = deps;

  return {
    withDb: (next) => createDeviceGrantRepository({ ...deps, db: next }),
    insert: (input) => insert(deps, input),
    findActiveBySecretHash: (secretHash) =>
      one(db, 'deviceGrant.findActiveBySecretHash', SQL.findActiveBySecretHash, [secretHash]),
    findById: (id) => one(db, 'deviceGrant.findById', SQL.findById, [id]),
    listByParentId: (parentId) => listByParentId(db, parentId),
    listProfiles: (grantId) => listProfiles(db, grantId),
    permits: (grantId, studentId) => permits(db, grantId, studentId),
    touch: async (id, at) => {
      await execute(db, 'deviceGrant.touch', SQL.touch, [id, at]);
    },
    revoke: async (id, parentId, at) =>
      (await execute(db, 'deviceGrant.revoke', SQL.revoke, [id, parentId, at])) > 0,
    revokeAllForParent: (parentId, at) =>
      execute(db, 'deviceGrant.revokeAllForParent', SQL.revokeAllForParent, [parentId, at]),
  };
}

/**
 * Two statements, because the scoping rows are a second table. Not a transaction: a grant with
 * no children is unusable rather than dangerous, and the caller reads it back before returning.
 */
async function insert(
  deps: DeviceGrantRepositoryDeps,
  input: { parentId: string; label: string; secretHash: string; studentIds: readonly string[] },
): Promise<DeviceGrant> {
  const id = deps.ids.next();

  await runQuery<DeviceGrantRow>({
    db: deps.db,
    operation: 'deviceGrant.insert',
    sql: SQL.insert,
    params: [id, input.parentId, input.label, input.secretHash],
  });

  await runQuery({
    db: deps.db,
    operation: 'deviceGrant.scope',
    sql: SQL.scope,
    params: [id, [...input.studentIds], input.parentId],
  });

  const grant = await one(deps.db, 'deviceGrant.findById', SQL.findById, [id]);
  if (!grant) throw new NotFoundError('deviceGrant.insert returned no row');
  return grant;
}

async function one(
  db: Queryable,
  operation: string,
  sql: string,
  params: readonly unknown[],
): Promise<DeviceGrant | null> {
  const { rows } = await runQuery<DeviceGrantRow>({ db, operation, sql, params });
  const row = rows[0];
  return row ? toDeviceGrant(row) : null;
}

async function listByParentId(db: Queryable, parentId: string): Promise<readonly DeviceGrant[]> {
  const { rows } = await runQuery<DeviceGrantRow>({
    db,
    operation: 'deviceGrant.listByParentId',
    sql: SQL.listByParentId,
    params: [parentId],
  });
  return rows.map(toDeviceGrant);
}

async function listProfiles(
  db: Queryable,
  grantId: string,
): Promise<readonly ChildProfileSummary[]> {
  const { rows } = await runQuery<ChildProfileRow>({
    db,
    operation: 'deviceGrant.listProfiles',
    sql: SQL.listProfiles,
    params: [grantId],
  });
  return rows.map(toChildProfileSummary);
}

async function permits(db: Queryable, grantId: string, studentId: string): Promise<boolean> {
  const { rows } = await runQuery<{ permitted: boolean }>({
    db,
    operation: 'deviceGrant.permits',
    sql: SQL.permits,
    params: [grantId, studentId],
  });
  return rows[0]?.permitted === true;
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
