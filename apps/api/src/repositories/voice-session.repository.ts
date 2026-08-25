import { z } from 'zod';

import { runQuery } from '@/db/run-query';
import type { Queryable } from '@/db/types';

import type { QueryResultRow } from 'pg';

const sessionRowSchema = z.object({ connection_epoch: z.number().int().nonnegative() });
type SessionRow = QueryResultRow & z.infer<typeof sessionRowSchema>;

export type VoiceSessionRepository = Readonly<{
  open(
    input: Readonly<{
      sessionId: string;
      region: string;
      processorMap: Readonly<Record<string, string>>;
    }>,
  ): Promise<number>;
  close(sessionId: string, at: Date): Promise<boolean>;
  closeForStudent(studentId: string, at: Date): Promise<readonly string[]>;
  findOpen(sessionId: string): Promise<Readonly<{ connectionEpoch: number }> | null>;
}>;

export function createVoiceSessionRepository(db: Queryable): VoiceSessionRepository {
  return {
    open: async (input) => {
      const result = await runQuery<SessionRow>({
        db,
        operation: 'voiceSession.open',
        sql: `INSERT INTO voice_session (session_id, region, processor_map)
              VALUES ($1, $2, $3::jsonb)
              ON CONFLICT (session_id) DO UPDATE SET
                connection_epoch = voice_session.connection_epoch + 1,
                region = EXCLUDED.region, processor_map = EXCLUDED.processor_map,
                closed_at = NULL
              RETURNING connection_epoch`,
        params: [input.sessionId, input.region, JSON.stringify(input.processorMap)],
      });
      const row = result.rows[0];
      if (row === undefined) throw new Error('voiceSession.open returned no row');
      return sessionRowSchema.parse(row).connection_epoch;
    },
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
      const result = await runQuery<QueryResultRow & { session_id: string }>({
        db,
        operation: 'voiceSession.closeForStudent',
        sql: `UPDATE voice_session vs SET closed_at = $2
              FROM session s WHERE vs.session_id = s.id AND s.student_id = $1
              RETURNING vs.session_id`,
        params: [studentId, at],
      });
      return result.rows.map((row) => row.session_id);
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
