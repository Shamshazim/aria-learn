/**
 * Correction history (P3-01; the path that writes it is P3-06). `master-plan.md` §12.6: what
 * Aria believes about a child can be corrected, and every correction stays auditable.
 *
 * A correction with no replacement and no new value is a retraction: consumers treat the
 * target as absent.
 */

export const CORRECTION_TARGETS = ['fact', 'episode'] as const;
export type CorrectionTarget = (typeof CORRECTION_TARGETS)[number];

export const CORRECTED_BY = ['parent', 'child', 'staff'] as const;
export type CorrectedBy = (typeof CORRECTED_BY)[number];

/** Who corrected it. A parent is always identified; a child never is. */
export type CorrectionAuthor =
  | Readonly<{ correctedBy: 'parent'; correctedById: string }>
  | Readonly<{ correctedBy: 'child'; correctedById: null }>
  | Readonly<{ correctedBy: 'staff'; correctedById: string | null }>;

export type FactCorrection<Time = string> = CorrectionAuthor &
  Readonly<{
    id: string;
    studentId: string;
    targetKind: CorrectionTarget;
    /** The row being corrected. It may already be superseded: history is kept. */
    targetId: string;
    /** `null` with `newValue: null` is a retraction. */
    replacementId: string | null;
    oldValue: Readonly<Record<string, unknown>>;
    newValue: Readonly<Record<string, unknown>> | null;
    reason: string | null;
    at: Time;
  }>;
