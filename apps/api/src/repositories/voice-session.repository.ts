import { z } from 'zod';

import { runQuery } from '@/db/run-query';
import type { Queryable } from '@/db/types';

import type { QueryResultRow } from 'pg';

const sessionRowSchema = z.object({ connection_epoch: z.number().int().nonnegative() });
const closedSessionRowSchema = sessionRowSchema.extend({ session_id: z.uuid() });
type SessionRow = QueryResultRow & z.infer<typeof sessionRowSchema>;
type ClosedSessionRow = QueryResultRow & z.infer<typeof closedSessionRowSchema>;

export type VoiceSessionRepository = Readonly<{
  withDb(db: Queryable): VoiceSessionRepository;
  rotate(
    input: Readonly<{
      sessionId: string;
      region: string;
      processorMap: Readonly<Record<string, string>>;
    }>,
  ): Promise<Readonly<{ previousEpoch: number | null; connectionEpoch: number }> | null>;
  close(sessionId: string, at: Date): Promise<boolean>;
  closeForStudent(
    studentId: string,
    at: Date,
  ): Promise<readonly Readonly<{ sessionId: string; connectionEpoch: number }>[]>;
  findOpen(sessionId: string): Promise<Readonly<{ connectionEpoch: number }> | null>;
}>;

export function createVoiceSessionRepository(db: Queryable): VoiceSessionRepository {
  return {
    withDb: (nextDb) => createVoiceSessionRepository(nextDb),
    rotate: (input) => rotate(db, input),
    close: async (sessionId, at) => {
      const result = await runQuery<QueryResultRow>({
        db,
        operation: 'voiceSession.close',
        sql: `UPDATE voice_session SET closed_at = COALESCE(closed_at, $2)
              WHERE session_id = $1 RETURNING session_id`,
        params: [sessionId, at],
      });
      return result.rowCount === 1;
    },
    closeForStudent: async (studentId, at) => {
      const result = await runQuery<ClosedSessionRow>({
        db,
        operation: 'voiceSession.closeForStudent',
        sql: `UPDATE voice_session vs SET closed_at = $2
              FROM session s WHERE vs.session_id = s.id AND s.student_id = $1
              RETURNING vs.session_id, vs.connection_epoch`,
        params: [studentId, at],
      });
      return result.rows.map((raw) => {
        const row = closedSessionRowSchema.parse(raw);
        return { sessionId: row.session_id, connectionEpoch: row.connection_epoch };
      });
    },
    findOpen: async (sessionId) => {
      const result = await runQuery<SessionRow>({
        db,
        operation: 'voiceSession.findOpen',
        sql: `SELECT connection_epoch FROM voice_session
              WHERE session_id = $1 AND closed_at IS NULL`,
        params: [sessionId],
      });
      const row = result.rows[0];
      return row === undefined
        ? null
        : { connectionEpoch: sessionRowSchema.parse(row).connection_epoch };
    },
  };
}

async function rotate(
  db: Queryable,
  input: Parameters<VoiceSessionRepository['rotate']>[0],
): ReturnType<VoiceSessionRepository['rotate']> {
  const result = await runQuery<SessionRow>({
    db,
    operation: 'voiceSession.rotate',
    sql: `WITH active_session AS (
            SELECT id FROM session WHERE id = $1 AND ended_at IS NULL FOR UPDATE
          )
          INSERT INTO voice_session (session_id, region, processor_map)
          SELECT id, $2, $3::jsonb FROM active_session
          ON CONFLICT (session_id) DO UPDATE SET
            connection_epoch = voice_session.connection_epoch + 1,
            region = EXCLUDED.region, processor_map = EXCLUDED.processor_map,
            closed_at = NULL
          RETURNING connection_epoch`,
    params: [input.sessionId, input.region, JSON.stringify(input.processorMap)],
  });
  const row = result.rows[0];
  if (row === undefined) return null;
  const connectionEpoch = sessionRowSchema.parse(row).connection_epoch;
  return { previousEpoch: connectionEpoch === 0 ? null : connectionEpoch - 1, connectionEpoch };
}
