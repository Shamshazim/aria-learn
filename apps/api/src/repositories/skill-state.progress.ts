import { z } from 'zod';

import { runQuery } from '@/db/run-query';
import type { Queryable } from '@/db/types';
import type { SkillState } from '@/types/skill-state';

/**
 * The scheduler's reads and writes of `skill_state` (P3-04). Split from the repository for the
 * 300-line rule. The arithmetic — strength, interval, due date — lives in `@aria/tutor`'s
 * scheduler; this file only moves its results in and out of the table.
 */
export const STATE_COLUMNS = `student_id, skill_code, strength, attempts, correct_streak, lapses,
  interval_days, last_seen_at, next_due_at`;

const stateRowSchema = z.object({
  student_id: z.string(),
  skill_code: z.string(),
  strength: z.coerce.number(),
  attempts: z.number().int(),
  correct_streak: z.number().int(),
  lapses: z.number().int(),
  interval_days: z.coerce.number(),
  last_seen_at: z.date().nullable(),
  next_due_at: z.date().nullable(),
});
export type StateRow = z.infer<typeof stateRowSchema>;

export function mapState(input: StateRow): SkillState {
  const row = stateRowSchema.parse(input);
  return {
    studentId: row.student_id,
    skillCode: row.skill_code,
    strength: row.strength,
    attempts: row.attempts,
    correctStreak: row.correct_streak,
    lapses: row.lapses,
    intervalDays: row.interval_days,
    lastSeenAt: row.last_seen_at,
    nextDueAt: row.next_due_at,
  };
}

export async function listProgress(
  db: Queryable,
  studentId: string,
): Promise<readonly SkillState[]> {
  const result = await runQuery<StateRow>({
    db,
    operation: 'skillState.listForStudent',
    sql: `SELECT ${STATE_COLUMNS} FROM skill_state WHERE student_id = $1 ORDER BY skill_code`,
    params: [studentId],
  });
  return result.rows.map(mapState);
}

/**
 * The row, locked until the transaction ends, so two commits for one skill read-modify-write
 * in turn. A row that does not exist yet cannot be locked; two first answers racing each
 * other both insert, and the later write wins — the same answer recorded twice at strength 0
 * is the worst that can happen.
 */
export async function findProgressForUpdate(
  db: Queryable,
  studentId: string,
  skillCode: string,
): Promise<SkillState | null> {
  const result = await runQuery<StateRow>({
    db,
    operation: 'skillState.findForUpdate',
    sql: `SELECT ${STATE_COLUMNS} FROM skill_state
          WHERE student_id = $1 AND skill_code = $2 FOR UPDATE`,
    params: [studentId, skillCode],
  });
  return result.rows[0] === undefined ? null : mapState(result.rows[0]);
}

/** Writes each state whole, in one statement. */
export async function saveProgress(db: Queryable, states: readonly SkillState[]): Promise<void> {
  if (states.length === 0) return;
  await runQuery({
    db,
    operation: 'skillState.bulkUpsert',
    sql: `INSERT INTO skill_state (${STATE_COLUMNS})
          SELECT * FROM unnest($1::uuid[], $2::varchar[], $3::numeric[], $4::int[], $5::int[],
                               $6::int[], $7::numeric[], $8::timestamptz[], $9::timestamptz[])
          ON CONFLICT (student_id, skill_code) DO UPDATE SET
            strength = EXCLUDED.strength, attempts = EXCLUDED.attempts,
            correct_streak = EXCLUDED.correct_streak, lapses = EXCLUDED.lapses,
            interval_days = EXCLUDED.interval_days, last_seen_at = EXCLUDED.last_seen_at,
            next_due_at = EXCLUDED.next_due_at`,
    params: [
      states.map((state) => state.studentId),
      states.map((state) => state.skillCode),
      states.map((state) => state.strength),
      states.map((state) => state.attempts),
      states.map((state) => state.correctStreak),
      states.map((state) => state.lapses),
      states.map((state) => state.intervalDays),
      states.map((state) => state.lastSeenAt),
      states.map((state) => state.nextDueAt),
    ],
  });
}

/** The child's IANA timezone as stored, or `null`; the scheduler decides what null means. */
export async function timeZoneOf(db: Queryable, studentId: string): Promise<string | null> {
  const result = await runQuery<{ timezone: string | null }>({
    db,
    operation: 'student.timeZone',
    sql: 'SELECT timezone FROM student WHERE id = $1',
    params: [studentId],
  });
  return result.rows[0]?.timezone ?? null;
}

/**
 * A right answer on a skill counts towards unlearning each of its live misconceptions; the
 * one that reaches `clearAfter` is cleared in the same statement.
 */
export async function creditMisconceptions(
  db: Queryable,
  input: Readonly<{ studentId: string; skillCode: string; clearAfter: number; at: Date }>,
): Promise<void> {
  await runQuery({
    db,
    operation: 'studentMisconception.credit',
    sql: `UPDATE student_misconception sm
          SET correct_since_seen = sm.correct_since_seen + 1,
              cleared_at = CASE WHEN sm.correct_since_seen + 1 >= $3::int THEN $4::timestamptz END
          FROM misconception m
          WHERE sm.misconception_id = m.id AND sm.student_id = $1 AND m.skill_code = $2
            AND sm.cleared_at IS NULL`,
    params: [input.studentId, input.skillCode, input.clearAfter, input.at],
  });
}
