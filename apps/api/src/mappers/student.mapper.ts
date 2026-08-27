import { bandSchema, parseGrade } from '@aria/shared';

import { studentSettingsSchema } from '@/schemas/student-settings.schema';
import type { Student, StudentSettings } from '@/types/student';

import { unmappableRow } from './row';

/**
 * What a child's profile is before a parent has said anything about it (P2H-12).
 *
 * It lives beside the mapper because it is the value an empty `settings` column maps to, and
 * the repository writes the same object when it inserts a row — one default, in the layer that
 * owns the shape, rather than one in `schemas/` that a repository has to reach up for.
 */
export const DEFAULT_STUDENT_SETTINGS: StudentSettings = studentSettingsSchema.parse({});

export type StudentRow = {
  id: string;
  parent_id: string;
  display_name: string;
  grade: string;
  band: string;
  settings: unknown;
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

  // A settings object that does not parse is a row we wrote wrong, not a request we were
  // sent wrong, so it fails loudly here rather than silently falling back to defaults.
  const settings = studentSettingsSchema.safeParse(row.settings ?? {});
  if (!settings.success) throw unmappableRow('student', 'settings', row.id);

  return {
    id: row.id,
    parentId: row.parent_id,
    displayName: row.display_name,
    grade,
    band: band.data,
    settings: settings.data,
    createdAt: row.created_at,
  };
}
