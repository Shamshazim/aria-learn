import { runQuery } from '@/db/run-query';
import type { Queryable } from '@/db/types';
import { NotFoundError } from '@/errors';
import type { IdGenerator } from '@/lib/ids';
import { toDeletionRequest } from '@/mappers/device-access.mapper';
import type { DeletionRequestRow } from '@/mappers/device-access.mapper';
import type { DeletionRequest, DeletionStage, DeletionSubjectKind } from '@/types/deletion';

/**
 * The deletion ledger.
 *
 * `subject_id` is deliberately not a foreign key, which is the whole point of this table: the
 * row has to outlive the rows it describes, and a cascade would take the record of the
 * deletion with the deletion. That is also what makes it replayable after a restore from
 * backup — the one moment deleted data can come back.
 */
export type DeletionRequestRepository = {
  withDb(db: Queryable): DeletionRequestRepository;
  open(input: {
    subjectKind: DeletionSubjectKind;
    subjectId: string;
    provider: string | null;
    providerSubject: string | null;
  }): Promise<DeletionRequest>;
  advance(id: string, stage: DeletionStage): Promise<DeletionRequest>;
  complete(id: string, at: Date): Promise<DeletionRequest>;
  /** Records a failed attempt. The reason is stored for an operator, never for a caller. */
  recordFailure(id: string, reason: string): Promise<DeletionRequest>;
  /** Everything not yet finished, oldest first — the replay queue. */
  listPending(limit: number): Promise<readonly DeletionRequest[]>;
  findById(id: string): Promise<DeletionRequest | null>;
};

const COLUMNS = `id, subject_kind, subject_id, provider, provider_subject, stage, attempts,
                 last_error, requested_at, completed_at`;

/** Every statement this repository can issue, in one block — see `student.repository.ts`. */
const SQL = {
  open: `INSERT INTO deletion_request (id, subject_kind, subject_id, provider, provider_subject, stage)
         VALUES ($1, $2, $3, $4, $5, 'requested')
         RETURNING ${COLUMNS}`,

  advance: `UPDATE deletion_request SET stage = $2 WHERE id = $1 RETURNING ${COLUMNS}`,

  complete: `UPDATE deletion_request SET stage = 'complete', completed_at = $2, last_error = NULL
             WHERE id = $1
             RETURNING ${COLUMNS}`,

  recordFailure: `UPDATE deletion_request SET attempts = attempts + 1, last_error = $2
                  WHERE id = $1
                  RETURNING ${COLUMNS}`,

  listPending: `SELECT ${COLUMNS} FROM deletion_request
                WHERE completed_at IS NULL
                ORDER BY requested_at, id
                LIMIT $1`,

  findById: `SELECT ${COLUMNS} FROM deletion_request WHERE id = $1`,
} as const;

export type DeletionRequestRepositoryDeps = {
  db: Queryable;
  ids: IdGenerator;
};

export function createDeletionRequestRepository(
  deps: DeletionRequestRepositoryDeps,
): DeletionRequestRepository {
  const { db, ids } = deps;

  async function one(
    operation: string,
    sql: string,
    params: readonly unknown[],
  ): Promise<DeletionRequest> {
    const { rows } = await runQuery<DeletionRequestRow>({ db, operation, sql, params });
    const row = rows[0];
    if (!row) throw new NotFoundError(`${operation} matched no deletion request`);
    return toDeletionRequest(row);
  }

  return {
    withDb: (next) => createDeletionRequestRepository({ ...deps, db: next }),

    open: (input) =>
      one('deletionRequest.open', SQL.open, [
        ids.next(),
        input.subjectKind,
        input.subjectId,
        input.provider,
        input.providerSubject,
      ]),

    advance: (id, stage) => one('deletionRequest.advance', SQL.advance, [id, stage]),

    complete: (id, at) => one('deletionRequest.complete', SQL.complete, [id, at]),

    // Truncated, because the reason is a vendor error message and this table is not a log.
    recordFailure: (id, reason) =>
      one('deletionRequest.recordFailure', SQL.recordFailure, [id, reason.slice(0, 500)]),

    async listPending(limit) {
      const { rows } = await runQuery<DeletionRequestRow>({
        db,
        operation: 'deletionRequest.listPending',
        sql: SQL.listPending,
        params: [limit],
      });
      return rows.map(toDeletionRequest);
    },

    async findById(id) {
      const { rows } = await runQuery<DeletionRequestRow>({
        db,
        operation: 'deletionRequest.findById',
        sql: SQL.findById,
        params: [id],
      });
      const row = rows[0];
      return row ? toDeletionRequest(row) : null;
    },
  };
}
