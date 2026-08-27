import { z } from 'zod';

import { tutorMoveSchema, type TutorMove } from '@aria/shared';

import { runQuery } from '@/db/run-query';
import type { Queryable } from '@/db/types';
import type { IdGenerator } from '@/lib/ids';
import type { OutboxMove } from '@/types/voice';

import type { QueryResultRow } from 'pg';

const rowSchema = z.object({ server_seq: z.number().int().positive(), payload: z.unknown() });
type OutboxRow = QueryResultRow & z.infer<typeof rowSchema>;

export type MoveOutboxRepository = Readonly<{
  withDb(db: Queryable): MoveOutboxRepository;
  enqueueIfOpen(sessionId: string, move: TutorMove): Promise<void>;
  listAfter(sessionId: string, acknowledgedSeq: number): Promise<readonly OutboxMove[]>;
  acknowledge(sessionId: string, acknowledgedSeq: number, at: Date): Promise<void>;
}>;

export function createMoveOutboxRepository(deps: {
  db: Queryable;
  ids: IdGenerator;
}): MoveOutboxRepository {
  return {
    withDb: (db) => createMoveOutboxRepository({ ...deps, db }),
    enqueueIfOpen: (sessionId, move) => enqueueIfOpen(deps, sessionId, move),
    listAfter: (sessionId, acknowledgedSeq) => listAfter(deps.db, sessionId, acknowledgedSeq),
    acknowledge: (sessionId, acknowledgedSeq, at) =>
      acknowledge(deps.db, sessionId, acknowledgedSeq, at),
  };
}

async function enqueueIfOpen(
  deps: Parameters<typeof createMoveOutboxRepository>[0],
  sessionId: string,
  move: TutorMove,
): Promise<void> {
  const generationId = move.speech === null ? undefined : (move.generationId ?? deps.ids.next());
  const delivered = generationId === undefined ? move : { ...move, generationId };
  await runQuery<QueryResultRow>({
    db: deps.db,
    operation: 'moveOutbox.enqueueIfOpen',
    sql: `WITH next_seq AS (
            UPDATE voice_session SET next_server_seq = next_server_seq + 1
            WHERE session_id = $2 AND closed_at IS NULL
            RETURNING next_server_seq - 1 AS value
          )
          INSERT INTO move_outbox
            (id, session_id, server_seq, move_id, generation_id, payload)
          SELECT $1, $2, next_seq.value, $3, $4,
                 jsonb_set($5::jsonb, '{serverSeq}', to_jsonb(next_seq.value))
          FROM next_seq ON CONFLICT (session_id, move_id) DO NOTHING`,
    params: [deps.ids.next(), sessionId, move.id, generationId ?? null, JSON.stringify(delivered)],
  });
}

async function listAfter(
  db: Queryable,
  sessionId: string,
  acknowledgedSeq: number,
): Promise<readonly OutboxMove[]> {
  const result = await runQuery<OutboxRow>({
    db,
    operation: 'moveOutbox.listAfter',
    sql: `SELECT server_seq, payload FROM move_outbox
          WHERE session_id = $1 AND server_seq > $2 ORDER BY server_seq`,
    params: [sessionId, acknowledgedSeq],
  });
  return result.rows.map((raw) => {
    const row = rowSchema.parse(raw);
    return { serverSeq: row.server_seq, move: tutorMoveSchema.parse(row.payload) };
  });
}

async function acknowledge(
  db: Queryable,
  sessionId: string,
  acknowledgedSeq: number,
  at: Date,
): Promise<void> {
  await runQuery<QueryResultRow>({
    db,
    operation: 'moveOutbox.acknowledge',
    sql: `UPDATE move_outbox SET acknowledged_at = COALESCE(acknowledged_at, $3)
          WHERE session_id = $1 AND server_seq <= $2`,
    params: [sessionId, acknowledgedSeq, at],
  });
}
