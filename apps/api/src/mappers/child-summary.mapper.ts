import { childSummarySchema, type ChildSummary } from '@aria/shared';

import type { ChildLoginMethod } from '@/types/auth';
import type { Student } from '@/types/student';

/**
 * A child, as a child's device is allowed to see them (P2H-12).
 *
 * The whole point of this mapper is what it does not copy. A `Student` knows its parent's id;
 * a `ChildSummary` does not, and the parse at the end is what makes that a guarantee rather
 * than an intention — `childSummarySchema` is strict, so a field added to `Student` cannot
 * arrive on a child screen by being spread through here.
 */
export function toChildSummary(student: Student, loginMethod: ChildLoginMethod): ChildSummary {
  return childSummarySchema.parse({
    id: student.id,
    firstName: student.displayName,
    grade: student.grade,
    band: student.band,
    avatar: student.settings.avatar,
    loginMethod,
  });
}
