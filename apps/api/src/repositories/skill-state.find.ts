import type { Skill } from '@aria/shared';

import { runQuery } from '@/db/run-query';
import type { Queryable } from '@/db/types';
import type { RuntimeSkill } from '@/types/skill-state';

/**
 * The reads that choose what a child practises next. Split from the repository for the
 * 300-line rule; the writes stay there.
 */
export type SkillRow = {
  code: string;
  subject: Skill['subject'];
  strand: string;
  name: string;
  band: Skill['band'];
  prerequisites: string[];
};

export async function findDue(
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

export async function findPractice(
  db: Queryable,
  studentId: string,
  subject: string,
  band: Skill['band'],
): Promise<RuntimeSkill | null> {
  const result = await runQuery<SkillRow>({
    db,
    operation: 'skillState.findPractice',
    sql: `SELECT s.code, s.subject, s.strand, s.name, s.band, s.prerequisites
          FROM skill s LEFT JOIN skill_state ss
            ON ss.skill_code = s.code AND ss.student_id = $1
          WHERE s.subject = $2
          ORDER BY (s.band = $3) DESC,
                   COALESCE(ss.next_due_at, '-infinity'::timestamptz), s.code
          LIMIT 1`,
    params: [studentId, subject, band],
  });
  const row = result.rows[0];
  return row === undefined ? null : mapSkill(row);
}

export function mapSkill(row: SkillRow): RuntimeSkill {
  return {
    code: row.code,
    subject: row.subject,
    strand: row.strand,
    name: row.name,
    band: row.band,
    prerequisites: row.prerequisites,
  };
}
