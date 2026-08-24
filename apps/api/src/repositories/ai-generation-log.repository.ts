import type { GenerationLogEntry, SpendReport, SpendSummary } from '@/ai/cost/cost.types';
import { runQuery } from '@/db/run-query';
import type { Queryable } from '@/db/types';
import type { IdGenerator } from '@/lib/ids';

/**
 * Owns every AI-cost query. Cost per child per month is the `spendRows` GROUP BY over the
 * current month; callers do not need prompt or response bodies to derive it.
 */

type SumRow = { total_usd: string };
type SpendRow = { student_id: string; day_usd: string; month_usd: string };
type CountRow = { count: string };

export type AiGenerationLogRepository = Readonly<{
  insert(entry: GenerationLogEntry): Promise<void>;
  daySpend(studentId: string, at: Date): Promise<number>;
  report(at: Date, capUsd: number): Promise<SpendReport>;
}>;

export function createAiGenerationLogRepository(dependencies: {
  db: Queryable;
  ids: IdGenerator;
}): AiGenerationLogRepository {
  return {
    insert: (entry) => insert(dependencies, entry),
    daySpend: (studentId, at) => sumForDay(dependencies.db, studentId, at),
    report: (at, capUsd) => buildReport(dependencies.db, at, capUsd),
  };
}

async function insert(
  dependencies: { db: Queryable; ids: IdGenerator },
  entry: GenerationLogEntry,
): Promise<void> {
  await runQuery({
    db: dependencies.db,
    operation: 'aiGenerationLog.insert',
    sql: `INSERT INTO ai_generation_log
          (id, student_id, endpoint_name, model, tier, prompt_name, prompt_version,
           tokens_in, tokens_out, latency_ms, cost_usd, cached, ok)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    params: [
      dependencies.ids.next(),
      entry.studentId,
      entry.endpointName,
      entry.model,
      entry.tier,
      entry.promptName,
      entry.promptVersion,
      entry.tokensIn,
      entry.tokensOut,
      entry.latencyMs,
      entry.costUsd,
      entry.cached,
      entry.ok,
    ],
  });
}

async function sumForDay(db: Queryable, studentId: string, at: Date): Promise<number> {
  const { rows } = await runQuery<SumRow>({
    db,
    operation: 'aiGenerationLog.daySpend',
    sql: `SELECT COALESCE(SUM(cost_usd), 0)::text AS total_usd
          FROM ai_generation_log
          WHERE student_id = $1
            AND created_at >= date_trunc('day', $2::timestamptz)
            AND created_at < date_trunc('day', $2::timestamptz) + interval '1 day'`,
    params: [studentId, at],
  });
  return numeric(rows[0]?.total_usd);
}

async function buildReport(db: Queryable, at: Date, capUsd: number): Promise<SpendReport> {
  const [students, total, capped] = await Promise.all([
    spendRows(db, at),
    totalToday(db, at),
    cappedCount(db, at, capUsd),
  ]);
  return { students, totalTodayUsd: total, studentsAtCap: capped };
}

async function spendRows(db: Queryable, at: Date): Promise<readonly SpendSummary[]> {
  const { rows } = await runQuery<SpendRow>({
    db,
    operation: 'aiGenerationLog.spendReport',
    sql: `SELECT student_id,
            COALESCE(SUM(cost_usd) FILTER (WHERE created_at >= date_trunc('day', $1::timestamptz)), 0)::text AS day_usd,
            COALESCE(SUM(cost_usd), 0)::text AS month_usd
          FROM ai_generation_log
          WHERE student_id IS NOT NULL
            AND created_at >= date_trunc('month', $1::timestamptz)
          GROUP BY student_id ORDER BY student_id`,
    params: [at],
  });
  return rows.map((row) => ({
    studentId: row.student_id,
    dayUsd: numeric(row.day_usd),
    monthUsd: numeric(row.month_usd),
  }));
}

async function totalToday(db: Queryable, at: Date): Promise<number> {
  const { rows } = await runQuery<SumRow>({
    db,
    operation: 'aiGenerationLog.totalToday',
    sql: `SELECT COALESCE(SUM(cost_usd), 0)::text AS total_usd FROM ai_generation_log
          WHERE created_at >= date_trunc('day', $1::timestamptz)`,
    params: [at],
  });
  return numeric(rows[0]?.total_usd);
}

async function cappedCount(db: Queryable, at: Date, capUsd: number): Promise<number> {
  const { rows } = await runQuery<CountRow>({
    db,
    operation: 'aiGenerationLog.cappedCount',
    sql: `SELECT COUNT(*)::text AS count FROM (
            SELECT student_id FROM ai_generation_log
            WHERE student_id IS NOT NULL AND created_at >= date_trunc('day', $1::timestamptz)
            GROUP BY student_id HAVING SUM(cost_usd) >= $2
          ) capped`,
    params: [at, capUsd],
  });
  return numeric(rows[0]?.count);
}

function numeric(value: string | undefined): number {
  const parsed = Number(value ?? '0');
  return Number.isFinite(parsed) ? parsed : 0;
}
