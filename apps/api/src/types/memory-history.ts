import type {
  BriefEvidenceSnapshot,
  BriefPeriod,
  CorrectionAuthor,
  CorrectionTarget,
  EpisodeEvidence,
  FactCorrection,
  LearnerBrief,
  LearnerEpisode,
} from '@aria/shared';

/** Domain records as the API holds them: the shared shapes with real `Date`s (P3-01). */
export type EpisodeRecord = LearnerEpisode<Date>;
export type BriefRecord = LearnerBrief<Date>;
export type CorrectionRecord = FactCorrection<Date>;

/** An episode is evidence-backed from birth, like a fact: at least one source. */
export type NewLearnerEpisode = Omit<EpisodeRecord, 'id' | 'supersededBy'> &
  Readonly<{ evidence: readonly [EpisodeEvidence, ...EpisodeEvidence[]] }>;

/** The version is computed by the repository, never chosen by the caller. */
export type NewLearnerBrief = Readonly<{
  studentId: string;
  period: BriefPeriod;
  periodStart: string;
  writtenAt: Date;
  body: string;
  evidenceSnapshot: BriefEvidenceSnapshot;
  generator: string;
}>;

export type NewFactCorrection = CorrectionAuthor &
  Readonly<{
    studentId: string;
    targetKind: CorrectionTarget;
    targetId: string;
    replacementId: string | null;
    oldValue: Readonly<Record<string, unknown>>;
    newValue: Readonly<Record<string, unknown>> | null;
    reason: string | null;
    at: Date;
  }>;
