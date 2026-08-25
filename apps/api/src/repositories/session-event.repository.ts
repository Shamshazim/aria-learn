import { runQuery } from '@/db/run-query';
import type { Queryable } from '@/db/types';
import type { Clock } from '@/lib/clock';
import type { IdGenerator } from '@/lib/ids';
import { toSessionEvent, type SessionEventRow } from '@/mappers/session.mapper';
import type { NewSessionEvent, SessionEventRecord } from '@/types/session';

const COLUMNS = `id, session_id, seq, at, actor, kind, text, skill_code, correct,
  latency_ms, evidence, payload`;
const ALIASED_COLUMNS = `se.id, se.session_id, se.seq, se.at, se.actor, se.kind, se.text,
  se.skill_code, se.correct, se.latency_ms, se.evidence, se.payload`;

export type SessionEventRepository = Readonly<{
  withDb(db: Queryable): SessionEventRepository;
  append(input: NewSessionEvent): Promise<SessionEventRecord>;
  list(sessionId: string): Promise<readonly SessionEventRecord[]>;
  findLatestEvidence(studentId: string): Promise<SessionEventRecord | null>;
}>;

export function createSessionEventRepository(deps: {
  db: Queryable;
  ids: IdGenerator;
  clock: Clock;
}): SessionEventRepository {
  return {
    withDb: (db) => createSessionEventRepository({ ...deps, db }),
    append: (input) => append(deps, input),
    list: (sessionId) => list(deps.db, sessionId),
    findLatestEvidence: (studentId) => findLatestEvidence(deps.db, studentId),
  };
}

async function findLatestEvidence(
  db: Queryable,
  studentId: string,
): Promise<SessionEventRecord | null> {
  const result = await runQuery<SessionEventRow>({
    db,
    operation: 'sessionEvent.findLatestEvidence',
    sql: `SELECT ${ALIASED_COLUMNS}
          FROM session_event se JOIN session s ON s.id = se.session_id
          WHERE s.student_id = $1 AND s.ended_at IS NOT NULL
            AND s.id = (SELECT id FROM session WHERE student_id = $1 AND ended_at IS NOT NULL
                        ORDER BY ended_at DESC, id LIMIT 1)
            AND se.actor = 'aria' AND se.kind IN ('PRAISE', 'END')
          ORDER BY se.at DESC, se.seq DESC LIMIT 1`,
    params: [studentId],
  });
  return result.rows[0] === undefined ? null : toSessionEvent(result.rows[0]);
}

async function append(
  deps: Parameters<typeof createSessionEventRepository>[0],
  input: NewSessionEvent,
): Promise<SessionEventRecord> {
  const result = await runQuery<SessionEventRow>({
    db: deps.db,
    operation: 'sessionEvent.append',
    sql: `WITH next_seq AS (
            UPDATE session SET next_event_seq = next_event_seq + 1
            WHERE id = $2 RETURNING next_event_seq - 1 AS value
          )
          INSERT INTO session_event
          (id, session_id, seq, at, actor, kind, text, skill_code, correct,
           latency_ms, evidence, payload)
          SELECT $1, $2, next_seq.value,
                 $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb
          FROM next_seq RETURNING ${COLUMNS}`,
    params: [
      deps.ids.next(),
      input.sessionId,
      input.at ?? deps.clock.now(),
      input.actor,
      input.kind,
      input.text,
      input.skillCode,
      input.correct,
      input.latencyMs,
      JSON.stringify(input.evidence),
      JSON.stringify(input.payload),
    ],
  });
  const row = result.rows[0];
  if (row === undefined) throw new Error('sessionEvent.append returned no row');
  return toSessionEvent(row);
}

async function list(db: Queryable, sessionId: string): Promise<readonly SessionEventRecord[]> {
  const result = await runQuery<SessionEventRow>({
    db,
    operation: 'sessionEvent.list',
    sql: `SELECT ${COLUMNS} FROM session_event WHERE session_id = $1 ORDER BY seq`,
    params: [sessionId],
  });
  return result.rows.map(toSessionEvent);
}
