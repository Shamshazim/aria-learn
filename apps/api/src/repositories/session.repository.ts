import { runQuery } from '@/db/run-query';
import type { Queryable } from '@/db/types';
import type { IdGenerator } from '@/lib/ids';
import { toTutorSession, type SessionRow } from '@/mappers/session.mapper';
import type { NewTutorSession, SessionEndReason, TutorSessionRecord } from '@/types/session';

const COLUMNS = `id, student_id, subject, grade, band, started_at, ended_at,
  end_reason, plan, summary`;

export type SessionRepository = Readonly<{
  withDb(db: Queryable): SessionRepository;
  create(input: NewTutorSession): Promise<TutorSessionRecord>;
  findOpen(studentId: string): Promise<TutorSessionRecord | null>;
  findById(id: string): Promise<TutorSessionRecord | null>;
  findLatestEnded(studentId: string): Promise<TutorSessionRecord | null>;
  end(id: string, reason: SessionEndReason, endedAt: Date): Promise<TutorSessionRecord | null>;
  /** P2H-11: what this session came to, written once when it ends. */
  saveSummary(id: string, summary: string): Promise<TutorSessionRecord | null>;
  /** Merges into the plan: a `SWITCH` moves the session onto another skill mid-lesson. */
  updatePlan(
    id: string,
    patch: Readonly<Record<string, unknown>>,
  ): Promise<TutorSessionRecord | null>;
}>;

export function createSessionRepository(deps: {
  db: Queryable;
  ids: IdGenerator;
}): SessionRepository {
  return {
    withDb: (db) => createSessionRepository({ ...deps, db }),
    create: (input) => create(deps, input),
    findOpen: (studentId) => findOpen(deps.db, studentId),
    findById: (id) => findById(deps.db, id),
    findLatestEnded: (studentId) => findLatestEnded(deps.db, studentId),
    end: (id, reason, endedAt) => end(deps.db, id, reason, endedAt),
    saveSummary: (id, summary) => saveSummary(deps.db, id, summary),
    updatePlan: (id, patch) => updatePlan(deps.db, id, patch),
  };
}

async function updatePlan(
  db: Queryable,
  id: string,
  patch: Readonly<Record<string, unknown>>,
): Promise<TutorSessionRecord | null> {
  const result = await runQuery<SessionRow>({
    db,
    operation: 'session.updatePlan',
    sql: `UPDATE session SET plan = plan || $2::jsonb WHERE id = $1 RETURNING ${COLUMNS}`,
    params: [id, JSON.stringify(patch)],
  });
  return result.rows[0] === undefined ? null : toTutorSession(result.rows[0]);
}

async function findLatestEnded(
  db: Queryable,
  studentId: string,
): Promise<TutorSessionRecord | null> {
  const result = await runQuery<SessionRow>({
    db,
    operation: 'session.findLatestEnded',
    sql: `SELECT ${COLUMNS} FROM session WHERE student_id = $1 AND ended_at IS NOT NULL
          ORDER BY ended_at DESC, id LIMIT 1`,
    params: [studentId],
  });
  return result.rows[0] === undefined ? null : toTutorSession(result.rows[0]);
}

async function create(
  deps: Parameters<typeof createSessionRepository>[0],
  input: NewTutorSession,
): Promise<TutorSessionRecord> {
  const result = await runQuery<SessionRow>({
    db: deps.db,
    operation: 'session.create',
    sql: `INSERT INTO session (id, student_id, subject, grade, band, plan)
          VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING ${COLUMNS}`,
    params: [
      deps.ids.next(),
      input.studentId,
      input.subject,
      input.grade,
      input.band,
      JSON.stringify(input.plan ?? {}),
    ],
  });
  const row = result.rows[0];
  if (row === undefined) throw new Error('session.create returned no row');
  return toTutorSession(row);
}

async function findOpen(db: Queryable, studentId: string): Promise<TutorSessionRecord | null> {
  const result = await runQuery<SessionRow>({
    db,
    operation: 'session.findOpen',
    sql: `SELECT ${COLUMNS} FROM session WHERE student_id = $1 AND ended_at IS NULL LIMIT 1`,
    params: [studentId],
  });
  return result.rows[0] === undefined ? null : toTutorSession(result.rows[0]);
}

async function findById(db: Queryable, id: string): Promise<TutorSessionRecord | null> {
  const result = await runQuery<SessionRow>({
    db,
    operation: 'session.findById',
    sql: `SELECT ${COLUMNS} FROM session WHERE id = $1`,
    params: [id],
  });
  return result.rows[0] === undefined ? null : toTutorSession(result.rows[0]);
}

/** Written only where nothing is there yet, so a second `end` call cannot rewrite history. */
async function saveSummary(
  db: Queryable,
  id: string,
  summary: string,
): Promise<TutorSessionRecord | null> {
  const result = await runQuery<SessionRow>({
    db,
    operation: 'session.saveSummary',
    sql: `UPDATE session SET summary = COALESCE(summary, $2)
          WHERE id = $1 RETURNING ${COLUMNS}`,
    params: [id, summary],
  });
  return result.rows[0] === undefined ? null : toTutorSession(result.rows[0]);
}

async function end(
  db: Queryable,
  id: string,
  reason: SessionEndReason,
  endedAt: Date,
): Promise<TutorSessionRecord | null> {
  const result = await runQuery<SessionRow>({
    db,
    operation: 'session.end',
    sql: `UPDATE session SET ended_at = COALESCE(ended_at, $2),
            end_reason = COALESCE(end_reason, $3)
          WHERE id = $1 RETURNING ${COLUMNS}`,
    params: [id, endedAt, reason],
  });
  return result.rows[0] === undefined ? null : toTutorSession(result.rows[0]);
}
