/**
 * The learner brief (P3-01, written by P3-03): the parent-readable paragraph about a child,
 * versioned per period. A brief is built from current evidence, never from the previous
 * paragraph, so `evidenceSnapshot` records exactly what each version was built from.
 */

export const BRIEF_PERIODS = ['week', 'month', 'year'] as const;
export type BriefPeriod = (typeof BRIEF_PERIODS)[number];

export type BriefEvidenceSnapshot = Readonly<{
  factIds: readonly string[];
  episodeIds: readonly string[];
  /** `skill_state` is keyed by (student, skill), so the skill code identifies the row. */
  skillCodes: readonly string[];
}>;

export type LearnerBrief<Time = string> = Readonly<{
  id: string;
  studentId: string;
  period: BriefPeriod;
  /** A calendar date, `YYYY-MM-DD`: a period starts on a day, not at an instant. */
  periodStart: string;
  version: number;
  writtenAt: Time;
  body: string;
  evidenceSnapshot: BriefEvidenceSnapshot;
  /** Prompt id and model, so a rebuild can be compared with what was shown. */
  generator: string;
  supersededBy: string | null;
}>;
