import { createHash } from 'node:crypto';

import type { Misconception, Skill } from '@aria/shared';

import { runQuery } from '@/db/run-query';
import type { Queryable } from '@/db/types';
import type { Clock } from '@/lib/clock';
import { findPractice, type PracticeFit } from '@/repositories/skill-state.find';
import {
  creditMisconceptions,
  findProgressForUpdate,
  listProgress,
  mapState,
  saveProgress,
  STATE_COLUMNS,
  timeZoneOf,
  type StateRow,
} from '@/repositories/skill-state.progress';
import type { MisconceptionState, RuntimeSkill, SkillState } from '@/types/skill-state';

export type SkillStateRepository = Readonly<{
  withDb(db: Queryable): SkillStateRepository;
  seed(skills: readonly Skill[], misconceptions: readonly Misconception[]): Promise<void>;
  /**
   * The skill to practise when nothing in a subject is due: the soonest-due one, the child's
   * own band first. A class is never "unavailable" while it has a skill at all.
   */
  findPractice(studentId: string, subject: string, fit: PracticeFit): Promise<RuntimeSkill | null>;
  /** P3-04: every skill this child has state for — what the scheduler ranks from. */
  listForStudent(studentId: string): Promise<readonly SkillState[]>;
  /** P3-04: one skill's state, locked for the rest of the transaction. */
  findForUpdate(studentId: string, skillCode: string): Promise<SkillState | null>;
  /** P3-04: writes states the scheduler computed, whole. */
  bulkUpsert(states: readonly SkillState[]): Promise<void>;
  /** The child's stored IANA timezone, or `null` where none was set. */
  timeZoneOf(studentId: string): Promise<string | null>;
  /** P3-04: a right answer counts towards clearing each live misconception on the skill. */
  creditMisconceptions(
    input: Readonly<{ studentId: string; skillCode: string; clearAfter: number }>,
  ): Promise<void>;
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
    findPractice: (studentId, subject, fit) => findPractice(deps.db, studentId, subject, fit),
    listForStudent: (studentId) => listProgress(deps.db, studentId),
    findForUpdate: (studentId, code) => findProgressForUpdate(deps.db, studentId, code),
    bulkUpsert: (states) => saveProgress(deps.db, states),
    timeZoneOf: (studentId) => timeZoneOf(deps.db, studentId),
    creditMisconceptions: (input) =>
      creditMisconceptions(deps.db, { ...input, at: deps.clock.now() }),
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
      sql: `INSERT INTO skill
              (code, subject, strand, name, band, prerequisites, grade, unit, lesson, objectives, ordering)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (code) DO UPDATE SET subject = EXCLUDED.subject, strand = EXCLUDED.strand,
              name = EXCLUDED.name, band = EXCLUDED.band, prerequisites = EXCLUDED.prerequisites,
              grade = EXCLUDED.grade, unit = EXCLUDED.unit, lesson = EXCLUDED.lesson,
              objectives = EXCLUDED.objectives, ordering = EXCLUDED.ordering`,
      params: [
        skill.code,
        skill.subject,
        skill.strand,
        skill.name,
        skill.band,
        skill.prerequisites,
        skill.grade ?? null,
        skill.unit ?? null,
        skill.lesson ?? null,
        skill.objectives ?? [],
        skill.ordering ?? 0,
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
            SET seen_count = student_misconception.seen_count + 1, cleared_at = NULL,
                correct_since_seen = 0
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
    cleared: false,
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
    sql: `SELECT ${STATE_COLUMNS} FROM skill_state WHERE student_id = $1 AND skill_code = $2`,
    params: [studentId, skillCode],
  });
  return result.rows[0] === undefined ? null : mapState(result.rows[0]);
}

async function findMisconceptionState(
  db: Queryable,
  studentId: string,
  misconceptionId: string,
): Promise<MisconceptionState | null> {
  const result = await runQuery<{ seen_count: number; first_seen_at: Date; cleared: boolean }>({
    db,
    operation: 'studentMisconception.findState',
    sql: `SELECT seen_count, first_seen_at, cleared_at IS NOT NULL AS cleared
          FROM student_misconception
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
        cleared: row.cleared,
      };
}

/** Stable UUID-shaped runtime key while the authored inventory keeps readable ids. */
export function misconceptionRuntimeId(authoredId: string): string {
  const hex = createHash('sha256').update(authoredId).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
