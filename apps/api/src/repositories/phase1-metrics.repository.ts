import { z } from 'zod';

import type { Queryable } from '@/db/types';
import type { MetricEvent } from '@/observability/session-metrics';

export type Phase1MetricData = Readonly<{
  events: readonly MetricEvent[];
  endReasons: readonly string[];
  frustrationExitCount: number;
  arrivalLatencies: readonly number[];
  factCount: number;
  supportedFactCount: number;
  correctionCount: number;
  reflectedCorrectionCount: number;
}>;

export type Phase1MetricsRepository = Readonly<{ load(): Promise<Phase1MetricData> }>;

const eventRowSchema = z.object({
  session_id: z.string(),
  seq: z.number().int(),
  actor: z.string(),
  kind: z.string(),
  correct: z.boolean().nullable(),
  latency_ms: z.number().int().nullable(),
  evidence: z.record(z.string(), z.unknown()),
});

/**
 * Every statement this repository can issue, in one block.
 *
 * Hoisted out of `load` when X-04 added the synthetic filter, because the filter is the same
 * clause five times and a reviewer has to be able to see that it is on all five. Inline, the
 * one query that had been missed would have looked exactly like the four that had not.
 *
 * **The filter.** Every query here excludes a synthetic student (X-04, migration 029). The
 * Phase 1 report is evidence about children — whether they waited, whether a hint worked,
 * whether a durable fact had support behind it — and the synthetic probe drives whole sessions
 * through the same routes every five minutes. Folded in, its scripted turns would be a growing
 * share of every number, moving whenever the probe's schedule changes, and the report would
 * quietly become a measurement of our own monitoring.
 *
 * The join is to `student` rather than to a flag on `session`, so a probe cannot appear real
 * on a session somebody forgot to mark.
 */
const SQL = {
  events: `SELECT se.session_id, se.seq, se.actor, se.kind, se.correct, se.latency_ms,
                  se.evidence
           FROM session_event se
             JOIN session s ON s.id = se.session_id
             JOIN student st ON st.id = s.student_id
           WHERE NOT st.is_synthetic
           ORDER BY se.session_id, se.seq`,

  // Two facts per ended session: how it ended, and whether the child had shown a sign of
  // frustration before they left. The `EXISTS` pair is the definition of a frustration exit.
  sessions: `SELECT s.end_reason,
      EXISTS (SELECT 1 FROM session_event se WHERE se.session_id = s.id AND se.actor = 'child'
        AND se.kind = 'LEAVE') AND EXISTS (
          SELECT 1 FROM session_event signal WHERE signal.session_id = s.id
            AND signal.actor = 'child' AND signal.kind IN ('CONFUSED', 'PAUSE')
      ) AS frustrated
      FROM session s
        JOIN student st ON st.id = s.student_id
      WHERE s.end_reason IS NOT NULL AND NOT st.is_synthetic`,

  arrivals: `SELECT a.latency_ms
             FROM arrival_event a
               JOIN student st ON st.id = a.student_id
             WHERE a.latency_ms IS NOT NULL AND NOT st.is_synthetic`,

  facts: `SELECT COUNT(*)::int AS facts,
      COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM learner_fact_evidence e WHERE e.fact_id = f.id))::int AS supported
      FROM learner_fact f
        JOIN student st ON st.id = f.student_id
      WHERE f.superseded_by IS NULL AND NOT st.is_synthetic`,

  corrections: `SELECT COUNT(*)::int AS corrections,
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM session s JOIN session_event se ON se.session_id = s.id
        WHERE s.student_id = f.student_id AND s.started_at >= f.last_confirmed_at
          AND se.actor = 'aria' AND (se.evidence -> 'retrievedFactIds') ? f.id::text
      ))::int AS reflected
      FROM learner_fact f
        JOIN student st ON st.id = f.student_id
      WHERE NOT st.is_synthetic AND EXISTS (
        SELECT 1 FROM learner_fact_evidence e
        WHERE e.fact_id = f.id AND e.source_kind = 'parent_correction'
      )`,
} as const;

export function createPhase1MetricsRepository(db: Queryable): Phase1MetricsRepository {
  return { load: () => load(db) };
}

async function load(db: Queryable): Promise<Phase1MetricData> {
  const [eventResult, sessionResult, arrivalResult, factResult, correctionResult] =
    await Promise.all([
      db.query(SQL.events),
      db.query<{ end_reason: string; frustrated: boolean }>(SQL.sessions),
      db.query<{ latency_ms: number }>(SQL.arrivals),
      db.query<{ facts: number; supported: number }>(SQL.facts),
      db.query<{ corrections: number; reflected: number }>(SQL.corrections),
    ]);
  return {
    events: eventResult.rows.map((raw) => {
      const row = eventRowSchema.parse(raw);
      return {
        sessionId: row.session_id,
        seq: row.seq,
        actor: row.actor,
        kind: row.kind,
        correct: row.correct,
        latencyMs: row.latency_ms,
        evidence: row.evidence,
      };
    }),
    endReasons: sessionResult.rows.map((row) => row.end_reason),
    frustrationExitCount: sessionResult.rows.filter((row) => row.frustrated).length,
    arrivalLatencies: arrivalResult.rows.map((row) => row.latency_ms),
    factCount: factResult.rows[0]?.facts ?? 0,
    supportedFactCount: factResult.rows[0]?.supported ?? 0,
    correctionCount: correctionResult.rows[0]?.corrections ?? 0,
    reflectedCorrectionCount: correctionResult.rows[0]?.reflected ?? 0,
  };
}

/** Every statement the Phase 1 report runs, for a test that asserts the synthetic filter. */
export function phase1MetricStatements(): readonly string[] {
  return Object.values(SQL);
}
