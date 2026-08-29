import { runQuery } from '@/db/run-query';
import type { Queryable } from '@/db/types';
import { toDeletionRequest, type DeletionRequestRow } from '@/mappers/parent-access.mapper';
import type { DeletionRequest, DeletionStage, DeletionSubjectKind } from '@/types/parent-access';

/**
 * The erasure ledger (P0-28, master-plan.md §12.9).
 *
 * Every statement here is idempotent or advances one stage. That is what makes the replay in
 * `scripts/replay-deletions.ts` safe to run twice: a deletion that already finished is a row
 * the query below does not return.
 */
const COLUMNS = `id, subject_kind, subject_id, parent_id, provider_subject, stage,
  requested_at, updated_at, attempts, last_error`;

export type DeletionRequestRepository = Readonly<{
  withDb(db: Queryable): DeletionRequestRepository;
  open(
    input: Readonly<{
      id: string;
      subjectKind: DeletionSubjectKind;
      subjectId: string;
      parentId: string;
      providerSubject: string | null;
      at: Date;
    }>,
  ): Promise<DeletionRequest>;
  advance(id: string, stage: DeletionStage, at: Date): Promise<void>;
  /** A failed attempt, counted. The message is ours, never the vendor's raw response. */
  fail(id: string, reason: string, at: Date): Promise<void>;
  /** Everything not finished, oldest first. What the replay picks up. */
  listUnfinished(limit: number): Promise<readonly DeletionRequest[]>;
  findById(id: string): Promise<DeletionRequest | null>;
}>;

const SQL = {
  open: `INSERT INTO deletion_request
           (id, subject_kind, subject_id, parent_id, provider_subject, stage,
            requested_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'requested', $6, $6)
         RETURNING ${COLUMNS}`,

  advance: `UPDATE deletion_request SET stage = $2, updated_at = $3, last_error = NULL
            WHERE id = $1`,

  // The attempt counter is what turns "it keeps failing" into something a person can see
  // without reading a log.
  fail: `UPDATE deletion_request
         SET stage = 'failed', attempts = attempts + 1, last_error = $2, updated_at = $3
         WHERE id = $1`,

  listUnfinished: `SELECT ${COLUMNS} FROM deletion_request
                   WHERE stage <> 'complete'
                   ORDER BY requested_at, id
                   LIMIT $1`,

  findById: `SELECT ${COLUMNS} FROM deletion_request WHERE id = $1`,
} as const;

export function createDeletionRequestRepository(db: Queryable): DeletionRequestRepository {
  return {
    withDb: createDeletionRequestRepository,
    open: (input) => open(db, input),
    advance: async (id, stage, at) => {
      await runQuery({
        db,
        operation: 'deletionRequest.advance',
        sql: SQL.advance,
        params: [id, stage, at],
      });
    },
    fail: async (id, reason, at) => {
      await runQuery({
        db,
        operation: 'deletionRequest.fail',
        sql: SQL.fail,
        params: [id, reason, at],
      });
    },
    listUnfinished: (limit) => listUnfinished(db, limit),
    findById: (id) => findById(db, id),
  };
}

async function open(
  db: Queryable,
  input: Readonly<{
    id: string;
    subjectKind: DeletionSubjectKind;
    subjectId: string;
    parentId: string;
    providerSubject: string | null;
    at: Date;
  }>,
): Promise<DeletionRequest> {
  const { rows } = await runQuery<DeletionRequestRow>({
    db,
    operation: 'deletionRequest.open',
    sql: SQL.open,
    params: [
      input.id,
      input.subjectKind,
      input.subjectId,
      input.parentId,
      input.providerSubject,
      input.at,
    ],
  });

  const row = rows[0];
  if (row === undefined) throw new Error('deletion_request.open returned no row');
  return toDeletionRequest(row);
}

async function listUnfinished(db: Queryable, limit: number): Promise<readonly DeletionRequest[]> {
  const { rows } = await runQuery<DeletionRequestRow>({
    db,
    operation: 'deletionRequest.listUnfinished',
    sql: SQL.listUnfinished,
    params: [limit],
  });

  return rows.map(toDeletionRequest);
}

async function findById(db: Queryable, id: string): Promise<DeletionRequest | null> {
  const { rows } = await runQuery<DeletionRequestRow>({
    db,
    operation: 'deletionRequest.findById',
    sql: SQL.findById,
    params: [id],
  });

  const row = rows[0];
  return row === undefined ? null : toDeletionRequest(row);
}
