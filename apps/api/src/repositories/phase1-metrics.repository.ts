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

export function createPhase1MetricsRepository(db: Queryable): Phase1MetricsRepository {
  return { load: () => load(db) };
}

async function load(db: Queryable): Promise<Phase1MetricData> {
  const [eventResult, sessionResult, arrivalResult, factResult, correctionResult] =
    await Promise.all([
      db.query(
        'SELECT session_id, seq, actor, kind, correct, latency_ms, evidence FROM session_event ORDER BY session_id, seq',
      ),
      db.query<{ end_reason: string; frustrated: boolean }>(`SELECT s.end_reason,
      EXISTS (SELECT 1 FROM session_event se WHERE se.session_id = s.id AND se.actor = 'child'
        AND se.kind = 'LEAVE') AND EXISTS (
          SELECT 1 FROM session_event signal WHERE signal.session_id = s.id
            AND signal.actor = 'child' AND signal.kind IN ('CONFUSED', 'PAUSE')
      ) AS frustrated
      FROM session s WHERE s.end_reason IS NOT NULL`),
      db.query<{ latency_ms: number }>(
        'SELECT latency_ms FROM arrival_event WHERE latency_ms IS NOT NULL',
      ),
      db.query<{ facts: number; supported: number }>(`SELECT COUNT(*)::int AS facts,
      COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM learner_fact_evidence e WHERE e.fact_id = f.id))::int AS supported
      FROM learner_fact f WHERE f.superseded_by IS NULL`),
      db.query<{ corrections: number; reflected: number }>(`SELECT COUNT(*)::int AS corrections,
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM session s JOIN session_event se ON se.session_id = s.id
        WHERE s.student_id = f.student_id AND s.started_at >= f.last_confirmed_at
          AND se.actor = 'aria' AND (se.evidence -> 'retrievedFactIds') ? f.id::text
      ))::int AS reflected
      FROM learner_fact f WHERE EXISTS (
        SELECT 1 FROM learner_fact_evidence e
        WHERE e.fact_id = f.id AND e.source_kind = 'parent_correction'
      )`),
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
