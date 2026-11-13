import { runQuery } from '@/db/run-query';
import type { Queryable } from '@/db/types';

/** One fact in a rebuild's shadow set (P3-02). */
export type ShadowFactRow = Readonly<{
  id: string;
  kind: string;
  value: Readonly<Record<string, unknown>>;
  confidence: number;
  firstObservedAt: Date;
  lastConfirmedAt: Date;
  expiresAt: Date | null;
  corrected: boolean;
}>;

export type ShadowEpisodeRow = Readonly<{
  id: string;
  at: Date;
  kind: string;
  summary: string;
  importance: number;
  skillCode: string | null;
  sourceSessionId: string;
  expiresAt: Date | null;
}>;

/**
 * The rebuild's writes (P3-02). Only these tables: a rebuild never touches live memory, and
 * this repository has no statement that could.
 */
export type MemoryShadowRepository = Readonly<{
  withDb(db: Queryable): MemoryShadowRepository;
  lockStudent(studentId: string): Promise<void>;
  startRun(input: Readonly<{ id: string; studentId: string; at: Date }>): Promise<void>;
  saveFacts(runId: string, studentId: string, rows: readonly ShadowFactRow[]): Promise<void>;
  saveEpisodes(runId: string, studentId: string, rows: readonly ShadowEpisodeRow[]): Promise<void>;
  finishRun(
    runId: string,
    input: Readonly<{ at: Date; driftScore: number; report: Readonly<Record<string, unknown>> }>,
  ): Promise<void>;
  /** Every child, for `--all`. */
  studentIds(): Promise<readonly string[]>;
}>;

export function createMemoryShadowRepository(db: Queryable): MemoryShadowRepository {
  return {
    withDb: (next) => createMemoryShadowRepository(next),
    lockStudent: (studentId) => lockStudent(db, studentId),
    startRun: (input) => startRun(db, input),
    saveFacts: (runId, studentId, rows) => saveFacts(db, runId, studentId, rows),
    saveEpisodes: (runId, studentId, rows) => saveEpisodes(db, runId, studentId, rows),
    finishRun: (runId, input) => finishRun(db, runId, input),
    studentIds: () => studentIds(db),
  };
}

async function lockStudent(db: Queryable, studentId: string): Promise<void> {
  await runQuery({
    db,
    operation: 'memoryRebuild.lock',
    sql: "SELECT pg_advisory_xact_lock(hashtext('memory-rebuild:' || $1))",
    params: [studentId],
  });
}

async function startRun(
  db: Queryable,
  { id, studentId, at }: Readonly<{ id: string; studentId: string; at: Date }>,
): Promise<void> {
  await runQuery({
    db,
    operation: 'memoryRebuild.start',
    sql: 'INSERT INTO memory_rebuild_run (id, student_id, started_at) VALUES ($1, $2, $3)',
    params: [id, studentId, at],
  });
}

async function saveFacts(
  db: Queryable,
  runId: string,
  studentId: string,
  rows: readonly ShadowFactRow[],
): Promise<void> {
  if (rows.length === 0) return;
  await runQuery({
    db,
    operation: 'memoryRebuild.saveFacts',
    sql: `INSERT INTO learner_fact_shadow
            (rebuild_run_id, id, student_id, kind, value, confidence, first_observed_at,
             last_confirmed_at, expires_at, corrected)
          SELECT $1, item.id, $2, item.kind, item.value, item.confidence, item.first_observed_at,
                 item.last_confirmed_at, item.expires_at, item.corrected
          FROM jsonb_to_recordset($3::jsonb) AS item(
            id uuid, kind text, value jsonb, confidence numeric, first_observed_at timestamptz,
            last_confirmed_at timestamptz, expires_at timestamptz, corrected boolean)`,
    params: [
      runId,
      studentId,
      JSON.stringify(
        rows.map((row) => ({
          id: row.id,
          kind: row.kind,
          value: row.value,
          confidence: row.confidence,
          first_observed_at: row.firstObservedAt,
          last_confirmed_at: row.lastConfirmedAt,
          expires_at: row.expiresAt,
          corrected: row.corrected,
        })),
      ),
    ],
  });
}

async function saveEpisodes(
  db: Queryable,
  runId: string,
  studentId: string,
  rows: readonly ShadowEpisodeRow[],
): Promise<void> {
  if (rows.length === 0) return;
  await runQuery({
    db,
    operation: 'memoryRebuild.saveEpisodes',
    sql: `INSERT INTO learner_episode_shadow
            (rebuild_run_id, id, student_id, at, kind, summary, importance, skill_code,
             source_session_id, expires_at)
          SELECT $1, item.id, $2, item.at, item.kind, item.summary, item.importance,
                 item.skill_code, item.source_session_id, item.expires_at
          FROM jsonb_to_recordset($3::jsonb) AS item(
            id uuid, at timestamptz, kind text, summary text, importance numeric,
            skill_code text, source_session_id uuid, expires_at timestamptz)`,
    params: [
      runId,
      studentId,
      JSON.stringify(
        rows.map((row) => ({
          id: row.id,
          at: row.at,
          kind: row.kind,
          summary: row.summary,
          importance: row.importance,
          skill_code: row.skillCode,
          source_session_id: row.sourceSessionId,
          expires_at: row.expiresAt,
        })),
      ),
    ],
  });
}

async function finishRun(
  db: Queryable,
  runId: string,
  {
    at,
    driftScore,
    report,
  }: Readonly<{ at: Date; driftScore: number; report: Readonly<Record<string, unknown>> }>,
): Promise<void> {
  await runQuery({
    db,
    operation: 'memoryRebuild.finish',
    sql: `UPDATE memory_rebuild_run SET finished_at = $2, drift_score = $3, report = $4::jsonb
          WHERE id = $1`,
    params: [runId, at, driftScore, JSON.stringify(report)],
  });
}

async function studentIds(db: Queryable): Promise<readonly string[]> {
  const result = await runQuery<{ id: string }>({
    db,
    operation: 'memoryRebuild.studentIds',
    sql: 'SELECT id FROM student WHERE NOT is_synthetic ORDER BY id',
    params: [],
  });
  return result.rows.map((row) => row.id);
}
