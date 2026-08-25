import { runQuery } from '@/db/run-query';
import type { Queryable } from '@/db/types';
import type { Clock } from '@/lib/clock';
import type { IdGenerator } from '@/lib/ids';
import { toArrivalEvent, type ArrivalEventRow } from '@/mappers/session.mapper';
import type { ArrivalEventRecord } from '@/types/session';

export type ArrivalEventRepository = Readonly<{
  insert(input: Omit<ArrivalEventRecord, 'id' | 'at'>): Promise<ArrivalEventRecord>;
  findById(id: string, studentId: string): Promise<ArrivalEventRecord | null>;
  setAccepted(id: string, studentId: string, accepted: boolean): Promise<boolean>;
}>;

export function createArrivalEventRepository(deps: {
  db: Queryable;
  ids: IdGenerator;
  clock: Clock;
}): ArrivalEventRepository {
  return {
    insert: (input) => insert(deps, input),
    findById: (id, studentId) => findById(deps.db, id, studentId),
    setAccepted: (id, studentId, accepted) => setAccepted(deps.db, id, studentId, accepted),
  };
}

async function findById(
  db: Queryable,
  id: string,
  studentId: string,
): Promise<ArrivalEventRecord | null> {
  const result = await runQuery<ArrivalEventRow>({
    db,
    operation: 'arrivalEvent.findById',
    sql: `SELECT id, student_id, at, welcome_kind, recommendation, accepted, latency_ms
          FROM arrival_event WHERE id = $1 AND student_id = $2`,
    params: [id, studentId],
  });
  return result.rows[0] === undefined ? null : toArrivalEvent(result.rows[0]);
}

async function insert(
  deps: Parameters<typeof createArrivalEventRepository>[0],
  input: Omit<ArrivalEventRecord, 'id' | 'at'>,
): Promise<ArrivalEventRecord> {
  const result = await runQuery<ArrivalEventRow>({
    db: deps.db,
    operation: 'arrivalEvent.insert',
    sql: `INSERT INTO arrival_event
          (id, student_id, at, welcome_kind, recommendation, accepted, latency_ms)
          VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
          RETURNING id, student_id, at, welcome_kind, recommendation, accepted, latency_ms`,
    params: [
      deps.ids.next(),
      input.studentId,
      deps.clock.now(),
      input.welcomeKind,
      input.recommendation === null ? null : JSON.stringify(input.recommendation),
      input.accepted,
      input.latencyMs,
    ],
  });
  const row = result.rows[0];
  if (row === undefined) throw new Error('arrivalEvent.insert returned no row');
  return toArrivalEvent(row);
}

async function setAccepted(
  db: Queryable,
  id: string,
  studentId: string,
  accepted: boolean,
): Promise<boolean> {
  const result = await runQuery<{ id: string }>({
    db,
    operation: 'arrivalEvent.setAccepted',
    sql: 'UPDATE arrival_event SET accepted = $3 WHERE id = $1 AND student_id = $2 RETURNING id',
    params: [id, studentId, accepted],
  });
  return result.rowCount === 1;
}
