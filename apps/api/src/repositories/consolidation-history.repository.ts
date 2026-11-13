import { runQuery } from '@/db/run-query';
import type { Queryable } from '@/db/types';

/**
 * What consolidation reads about a child's past that no other repository serves (P3-02): the
 * sessions in order, every graded answer across them (from which a skill's strength at any
 * session boundary is replayed, rather than trusted from `skill_state`), and the events the
 * safety layer flagged.
 */
export type SessionSpan = Readonly<{ id: string; startedAt: Date; endedAt: Date | null }>;

export type GradedAttempt = Readonly<{
  eventId: string;
  sessionId: string;
  skillCode: string;
  correct: boolean;
  latencyMs: number | null;
  at: Date;
}>;

export type ConsolidationHistoryRepository = Readonly<{
  withDb(db: Queryable): ConsolidationHistoryRepository;
  sessionsForStudent(studentId: string): Promise<readonly SessionSpan[]>;
  gradedAttempts(studentId: string): Promise<readonly GradedAttempt[]>;
  /** Events a `safety_flag` row points at; anything from them is never remembered. */
  flaggedEventIds(sessionId: string): Promise<ReadonlySet<string>>;
  /** An episode of this kind already rests on this event: the detector has fired for it. */
  hasEpisode(kind: string, sourceEventId: string): Promise<boolean>;
}>;

export function createConsolidationHistoryRepository(
  db: Queryable,
): ConsolidationHistoryRepository {
  return {
    withDb: (next) => createConsolidationHistoryRepository(next),
    sessionsForStudent: (studentId) => sessionsForStudent(db, studentId),
    gradedAttempts: (studentId) => gradedAttempts(db, studentId),
    flaggedEventIds: (sessionId) => flaggedEventIds(db, sessionId),
    hasEpisode: (kind, sourceEventId) => hasEpisode(db, kind, sourceEventId),
  };
}

async function sessionsForStudent(
  db: Queryable,
  studentId: string,
): Promise<readonly SessionSpan[]> {
  const result = await runQuery<{ id: string; started_at: Date; ended_at: Date | null }>({
    db,
    operation: 'consolidation.sessionsForStudent',
    sql: `SELECT id, started_at, ended_at FROM session
          WHERE student_id = $1 ORDER BY started_at, id`,
    params: [studentId],
  });
  return result.rows.map((row) => ({
    id: row.id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  }));
}

async function gradedAttempts(db: Queryable, studentId: string): Promise<readonly GradedAttempt[]> {
  const result = await runQuery<{
    id: string;
    session_id: string;
    skill_code: string;
    correct: boolean;
    latency_ms: number | null;
    at: Date;
  }>({
    db,
    operation: 'consolidation.gradedAttempts',
    sql: `SELECT e.id, e.session_id, e.skill_code, e.correct, e.latency_ms, e.at
          FROM session_event e JOIN session s ON s.id = e.session_id
          WHERE s.student_id = $1 AND e.actor = 'child' AND e.correct IS NOT NULL
            AND e.skill_code IS NOT NULL
          ORDER BY e.at, e.session_id, e.seq`,
    params: [studentId],
  });
  return result.rows.map((row) => ({
    eventId: row.id,
    sessionId: row.session_id,
    skillCode: row.skill_code,
    correct: row.correct,
    latencyMs: row.latency_ms,
    at: row.at,
  }));
}

async function flaggedEventIds(db: Queryable, sessionId: string): Promise<ReadonlySet<string>> {
  const result = await runQuery<{ event_id: string }>({
    db,
    operation: 'consolidation.flaggedEvents',
    sql: 'SELECT event_id FROM safety_flag WHERE session_id = $1 AND event_id IS NOT NULL',
    params: [sessionId],
  });
  return new Set(result.rows.map((row) => row.event_id));
}

async function hasEpisode(db: Queryable, kind: string, sourceEventId: string): Promise<boolean> {
  const result = await runQuery<{ exists: boolean }>({
    db,
    operation: 'consolidation.hasEpisode',
    sql: `SELECT EXISTS (
            SELECT 1 FROM learner_episode_evidence ev
            JOIN learner_episode ep ON ep.id = ev.episode_id
            WHERE ep.kind = $1 AND ev.source_kind = 'session_event' AND ev.source_id = $2
          ) AS exists`,
    params: [kind, sourceEventId],
  });
  return result.rows[0]?.exists ?? false;
}
