import { runQuery } from '@/db/run-query';
import type { Queryable } from '@/db/types';
import { toConsentRecord, type ConsentRecordRow } from '@/mappers/parent-access.mapper';
import type { ConsentMethod, ConsentRecord } from '@/types/parent-access';

/**
 * Verifiable parental consent (P0-28, master-plan.md §12).
 *
 * Append-only. Withdrawing sets `withdrawn_at`; nothing here deletes a row, because the
 * record that consent was once given is what explains why a child's data existed at all.
 */
const COLUMNS = `id, parent_id, method, source_reference, disclosure_version,
  granted_at, withdrawn_at`;

export type ConsentRecordRepository = Readonly<{
  withDb(db: Queryable): ConsentRecordRepository;
  insert(
    input: Readonly<{
      id: string;
      parentId: string;
      method: ConsentMethod;
      sourceReference: string | null;
      disclosureVersion: string;
      at: Date;
    }>,
  ): Promise<ConsentRecord>;
  /** The live consent for this parent, or null. What `addChild` is gated on. */
  findActive(parentId: string): Promise<ConsentRecord | null>;
  /** Everything ever granted, withdrawn included: this is the audit answer. */
  listByParent(parentId: string): Promise<readonly ConsentRecord[]>;
  withdrawAll(parentId: string, at: Date): Promise<number>;
}>;

const SQL = {
  insert: `INSERT INTO consent_record
             (id, parent_id, method, source_reference, disclosure_version, granted_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING ${COLUMNS}`,

  // Newest first: a parent who re-consented after withdrawing is covered by the latest one.
  findActive: `SELECT ${COLUMNS} FROM consent_record
               WHERE parent_id = $1 AND withdrawn_at IS NULL
               ORDER BY granted_at DESC, id DESC
               LIMIT 1`,

  listByParent: `SELECT ${COLUMNS} FROM consent_record
                 WHERE parent_id = $1
                 ORDER BY granted_at DESC, id DESC`,

  withdrawAll: `UPDATE consent_record SET withdrawn_at = $2
                WHERE parent_id = $1 AND withdrawn_at IS NULL`,
} as const;

export function createConsentRecordRepository(db: Queryable): ConsentRecordRepository {
  return {
    withDb: createConsentRecordRepository,
    insert: (input) => insert(db, input),
    findActive: (parentId) => findActive(db, parentId),
    listByParent: (parentId) => listByParent(db, parentId),
    withdrawAll: async (parentId, at) => {
      const { rowCount } = await runQuery({
        db,
        operation: 'consentRecord.withdrawAll',
        sql: SQL.withdrawAll,
        params: [parentId, at],
      });
      return rowCount ?? 0;
    },
  };
}

async function insert(
  db: Queryable,
  input: Readonly<{
    id: string;
    parentId: string;
    method: ConsentMethod;
    sourceReference: string | null;
    disclosureVersion: string;
    at: Date;
  }>,
): Promise<ConsentRecord> {
  const { rows } = await runQuery<ConsentRecordRow>({
    db,
    operation: 'consentRecord.insert',
    sql: SQL.insert,
    params: [
      input.id,
      input.parentId,
      input.method,
      input.sourceReference,
      input.disclosureVersion,
      input.at,
    ],
  });

  const row = rows[0];
  if (row === undefined) throw new Error('consent_record.insert returned no row');
  return toConsentRecord(row);
}

async function findActive(db: Queryable, parentId: string): Promise<ConsentRecord | null> {
  const { rows } = await runQuery<ConsentRecordRow>({
    db,
    operation: 'consentRecord.findActive',
    sql: SQL.findActive,
    params: [parentId],
  });

  const row = rows[0];
  return row === undefined ? null : toConsentRecord(row);
}

async function listByParent(db: Queryable, parentId: string): Promise<readonly ConsentRecord[]> {
  const { rows } = await runQuery<ConsentRecordRow>({
    db,
    operation: 'consentRecord.listByParent',
    sql: SQL.listByParent,
    params: [parentId],
  });

  return rows.map(toConsentRecord);
}
