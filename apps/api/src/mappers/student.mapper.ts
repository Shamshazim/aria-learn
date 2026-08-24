import { bandSchema, parseGrade } from '@aria/shared';

import type { Student } from '@/types/student';

import { unmappableRow } from './row';

export type StudentRow = {
  id: string;
  parent_id: string;
  display_name: string;
  grade: string;
  band: string;
  created_at: Date;
};

/**
 * Field by field, never a spread.
 *
 * `grade` and `band` are parsed rather than asserted, even though a CHECK constraint already
 * guarantees them. The constraint protects today's rows; the parse protects against the day
 * the vocabulary changes and an old row no longer fits it. Data entering the process is
 * parsed, wherever it comes from (CODE-STANDARDS §1).
 */
export function toStudent(row: StudentRow): Student {
  const grade = parseGrade(row.grade);
  if (!grade) throw unmappableRow('student', 'grade', row.id);

  const band = bandSchema.safeParse(row.band);
  if (!band.success) throw unmappableRow('student', 'band', row.id);

  if (!(row.created_at instanceof Date)) {
    throw unmappableRow('student', 'created_at', row.id);
  }

  return {
    id: row.id,
    parentId: row.parent_id,
    displayName: row.display_name,
    grade,
    band: band.data,
    createdAt: row.created_at,
  };
}
