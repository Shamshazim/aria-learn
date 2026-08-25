import { createHash } from 'node:crypto';

import { z } from 'zod';

import type { Misconception, Skill } from '@aria/shared';

import { runQuery } from '@/db/run-query';
import type { Queryable } from '@/db/types';
import type { Clock } from '@/lib/clock';
import type { MisconceptionState, RuntimeSkill, SkillState } from '@/types/skill-state';

const stateRowSchema = z.object({
  student_id: z.string(),
  skill_code: z.string(),
  strength: z.coerce.number(),
  attempts: z.number().int(),
  correct_streak: z.number().int(),
  last_seen_at: z.date().nullable(),
  next_due_at: z.date().nullable(),
});
type StateRow = z.infer<typeof stateRowSchema>;

export type SkillStateRepository = Readonly<{
  withDb(db: Queryable): SkillStateRepository;
  seed(skills: readonly Skill[], misconceptions: readonly Misconception[]): Promise<void>;
  findDue(studentId: string, at: Date): Promise<readonly RuntimeSkill[]>;
  findUnmetPrerequisites(studentId: string, skillCode: string): Promise<readonly RuntimeSkill[]>;
  recordAttempt(
    input: Readonly<{ studentId: string; skillCode: string; correct: boolean }>,
  ): Promise<SkillState>;
  recordMisconception(studentId: string, misconceptionId: string): Promise<MisconceptionState>;
  findMisconceptionState(
    studentId: string,
    misconceptionId: string,
  ): Promise<MisconceptionState | null>;
  findState(studentId: string, skillCode: string): Promise<SkillState | null>;
}>;

export function createSkillStateRepository(deps: {
  db: Queryable;
  clock: Clock;
}): SkillStateRepository {
  return {
    withDb: (db) => createSkillStateRepository({ ...deps, db }),
    seed: (skills, misconceptions) => seed(deps.db, skills, misconceptions),
    findDue: (studentId, at) => findDue(deps.db, studentId, at),
    findUnmetPrerequisites: (studentId, skillCode) =>
      findUnmetPrerequisites(deps.db, studentId, skillCode),
    recordAttempt: (input) => recordAttempt(deps, input),
    recordMisconception: (studentId, id) => recordMisconception(deps, studentId, id),
    findMisconceptionState: (studentId, id) => findMisconceptionState(deps.db, studentId, id),
    findState: (studentId, code) => findState(deps.db, studentId, code),
  };
}

async function seed(
  db: Queryable,
  skills: readonly Skill[],
  misconceptions: readonly Misconception[],
): Promise<void> {
  for (const skill of skills) {
    await runQuery({
      db,
      operation: 'skill.seed',
      sql: `INSERT INTO skill (code, subject, strand, name, band, prerequisites)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (code) DO UPDATE SET subject = EXCLUDED.subject, strand = EXCLUDED.strand,
              name = EXCLUDED.name, band = EXCLUDED.band, prerequisites = EXCLUDED.prerequisites`,
      params: [
        skill.code,
        skill.subject,
        skill.strand,
        skill.name,
        skill.band,
        skill.prerequisites,
      ],
    });
  }
  for (const misconception of misconceptions) await seedMisconception(db, misconception);
}

async function seedMisconception(db: Queryable, input: Misconception): Promise<void> {
  await runQuery({
    db,
    operation: 'misconception.seed',
    sql: `INSERT INTO misconception (id, skill_code, name, signature, remediation)
          VALUES ($1, $2, $3, $4::jsonb, $5)
          ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name,
            signature = EXCLUDED.signature, remediation = EXCLUDED.remediation`,
    params: [
      misconceptionRuntimeId(input.id),
      input.skillCode,
      input.name,
      JSON.stringify({ value: input.signature }),
      input.remediation,
    ],
  });
}

async function findDue(
  db: Queryable,
  studentId: string,
  at: Date,
): Promise<readonly RuntimeSkill[]> {
  const result = await runQuery<SkillRow>({
    db,
    operation: 'skillState.findDue',
    sql: `SELECT s.code, s.subject, s.strand, s.name, s.band, s.prerequisites
          FROM skill s LEFT JOIN skill_state ss
            ON ss.skill_code = s.code AND ss.student_id = $1
          WHERE ss.student_id IS NULL OR ss.next_due_at <= $2
          ORDER BY COALESCE(ss.next_due_at, '-infinity'::timestamptz), s.code`,
    params: [studentId, at],
  });
  return result.rows.map(mapSkill);
}

type SkillRow = {
  code: string;
  subject: Skill['subject'];
  strand: string;
  name: string;
  band: Skill['band'];
  prerequisites: string[];
};

async function findUnmetPrerequisites(
  db: Queryable,
  studentId: string,
  skillCode: string,
): Promise<readonly RuntimeSkill[]> {
  const result = await runQuery<SkillRow & { depth: number }>({
    db,
    operation: 'skillState.findUnmetPrerequisites',
    sql: `WITH RECURSIVE prereq(code, depth) AS (
            SELECT unnest(prerequisites), 1 FROM skill WHERE code = $2
            UNION ALL
            SELECT unnest(s.prerequisites), p.depth + 1
            FROM prereq p JOIN skill s ON s.code = p.code
          )
          SELECT s.code, s.subject, s.strand, s.name, s.band, s.prerequisites, p.depth
          FROM prereq p JOIN skill s ON s.code = p.code
          LEFT JOIN skill_state ss ON ss.student_id = $1 AND ss.skill_code = s.code
          WHERE COALESCE(ss.strength, 0) < 0.7 ORDER BY p.depth DESC, s.code`,
    params: [studentId, skillCode],
  });
  return result.rows.map(mapSkill);
}

async function recordAttempt(
  deps: Parameters<typeof createSkillStateRepository>[0],
  input: Readonly<{ studentId: string; skillCode: string; correct: boolean }>,
): Promise<SkillState> {
  const at = deps.clock.now();
  // provisional — Phase 3 scheduler replaces this fixed strength-based interval.
  const intervalHours = input.correct ? 72 : 24;
  const due = new Date(at.getTime() + intervalHours * 3_600_000);
  const result = await runQuery<StateRow>({
    db: deps.db,
    operation: 'skillState.recordAttempt',
    sql: `INSERT INTO skill_state
          (student_id, skill_code, strength, attempts, correct_streak, last_seen_at, next_due_at)
          VALUES ($1, $2, LEAST(1::numeric, GREATEST(0::numeric, $3::numeric)), 1, $4, $5, $6)
          ON CONFLICT (student_id, skill_code) DO UPDATE SET
            strength = LEAST(1, GREATEST(0, skill_state.strength + $3)),
            attempts = skill_state.attempts + 1,
            correct_streak = CASE WHEN $4 = 1 THEN skill_state.correct_streak + 1 ELSE 0 END,
            last_seen_at = $5, next_due_at = $6
          RETURNING student_id, skill_code, strength, attempts, correct_streak,
            last_seen_at, next_due_at`,
    params: [
      input.studentId,
      input.skillCode,
      input.correct ? 0.15 : -0.1,
      input.correct ? 1 : 0,
      at,
      due,
    ],
  });
  const row = result.rows[0];
  if (row === undefined) throw new Error('skillState.recordAttempt returned no row');
  return mapState(row);
}

async function recordMisconception(
  deps: Parameters<typeof createSkillStateRepository>[0],
  studentId: string,
  misconceptionId: string,
): Promise<MisconceptionState> {
  const at = deps.clock.now();
  const result = await runQuery<{ seen_count: number; first_seen_at: Date }>({
    db: deps.db,
    operation: 'studentMisconception.record',
    sql: `INSERT INTO student_misconception
          (student_id, misconception_id, seen_count, first_seen_at)
          VALUES ($1, $2, 1, $3)
          ON CONFLICT (student_id, misconception_id) DO UPDATE
            SET seen_count = student_misconception.seen_count + 1, cleared_at = NULL
          RETURNING seen_count, first_seen_at`,
    params: [studentId, misconceptionId, at],
  });
  const row = result.rows[0];
  if (row === undefined) throw new Error('studentMisconception.record returned no row');
  return {
    misconceptionId,
    seenCount: row.seen_count,
    firstSeenAt: row.first_seen_at,
    secondOrLater: row.seen_count >= 2,
  };
}

async function findState(
  db: Queryable,
  studentId: string,
  skillCode: string,
): Promise<SkillState | null> {
  const result = await runQuery<StateRow>({
    db,
    operation: 'skillState.findState',
    sql: `SELECT student_id, skill_code, strength, attempts, correct_streak,
            last_seen_at, next_due_at FROM skill_state
          WHERE student_id = $1 AND skill_code = $2`,
    params: [studentId, skillCode],
  });
  return result.rows[0] === undefined ? null : mapState(result.rows[0]);
}

async function findMisconceptionState(
  db: Queryable,
  studentId: string,
  misconceptionId: string,
): Promise<MisconceptionState | null> {
  const result = await runQuery<{ seen_count: number; first_seen_at: Date }>({
    db,
    operation: 'studentMisconception.findState',
    sql: `SELECT seen_count, first_seen_at FROM student_misconception
          WHERE student_id = $1 AND misconception_id = $2`,
    params: [studentId, misconceptionRuntimeId(misconceptionId)],
  });
  const row = result.rows[0];
  return row === undefined
    ? null
    : {
        misconceptionId,
        seenCount: row.seen_count,
        firstSeenAt: row.first_seen_at,
        secondOrLater: row.seen_count >= 2,
      };
}

function mapState(input: StateRow): SkillState {
  const row = stateRowSchema.parse(input);
  return {
    studentId: row.student_id,
    skillCode: row.skill_code,
    strength: row.strength,
    attempts: row.attempts,
    correctStreak: row.correct_streak,
    lastSeenAt: row.last_seen_at,
    nextDueAt: row.next_due_at,
  };
}

function mapSkill(row: SkillRow): RuntimeSkill {
  return {
    code: row.code,
    subject: row.subject,
    strand: row.strand,
    name: row.name,
    band: row.band,
    prerequisites: row.prerequisites,
  };
}

/** Stable UUID-shaped runtime key while the authored inventory keeps readable ids. */
export function misconceptionRuntimeId(authoredId: string): string {
  const hex = createHash('sha256').update(authoredId).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
