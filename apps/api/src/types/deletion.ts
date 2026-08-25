/**
 * "Delete means delete" (master-plan.md §12.9) spans Aria and the identity provider, so it
 * cannot be one statement and must not be one attempt. A deletion is a ledger row that moves
 * through stages and can be replayed — including after a restore from backup, which is the
 * one moment deleted rows can come back.
 */

export const DELETION_SUBJECT_KINDS = ['child', 'adult'] as const;
export type DeletionSubjectKind = (typeof DELETION_SUBJECT_KINDS)[number];

/**
 * `requested` → `local_deleted` → `complete`, with `failed` reserved for a provider call that
 * has exhausted its retries. A child deletion has no provider step and goes straight to
 * `complete`; an adult deletion sits at `local_deleted` until the vendor confirms.
 */
export const DELETION_STAGES = ['requested', 'local_deleted', 'complete', 'failed'] as const;
export type DeletionStage = (typeof DELETION_STAGES)[number];

export type DeletionRequest = {
  id: string;
  subjectKind: DeletionSubjectKind;
  subjectId: string;
  provider: string | null;
  providerSubject: string | null;
  stage: DeletionStage;
  attempts: number;
  lastError: string | null;
  requestedAt: Date;
  completedAt: Date | null;
};
