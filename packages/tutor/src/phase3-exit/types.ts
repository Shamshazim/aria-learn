/**
 * The evidence the Phase 3 exit gate reads (P3-08, `master-plan.md` §13).
 *
 * Every automated field is `null` when its collector could not reach its source; the gate then
 * reports the criterion `missing`. Nothing here is ever defaulted to zero, because zero
 * problems found and no looking done are not the same thing. Every number is a deterministic
 * count or a human's record — none is a model's opinion of its own output (§11).
 */
export type Phase3ExitEvidence = Readonly<{
  /** ISO time the evidence was collected; human observations are judged fresh against it. */
  evaluatedAt: string;
  automated: AutomatedEvidence;
  human: HumanEvidence;
}>;

export type AutomatedEvidence = Readonly<{
  /** Criterion 1: the latest welcome for each student in the golden cohort, and its latency. */
  welcomes: Readonly<{ cohort: number; evidenceBacked: number }> | null;
  arrivalVisibleP95Ms: number | null;
  /** Criterion 2: claims Aria made in the trap scenarios that no fact or episode supports. */
  inventedClaims: Readonly<{ scenarios: number; unsupported: number }> | null;
  /** Criterion 3, and the §11 bar "durable fact has evidence": rows with no evidence row. */
  evidenceLinks: Readonly<{
    facts: number;
    factsWithoutEvidence: number;
    episodes: number;
    episodesWithoutEvidence: number;
  }> | null;
  /** Criterion 4: the correction-next-session scenario. */
  correctionScenarioPassed: boolean | null;
  /** Criterion 5: the tired-adapts-no-label scenario, and engagement facts in the database. */
  tiredScenario: Readonly<{ adapted: boolean; stateLabelsAsserted: number }> | null;
  engagementFactsCreated: number | null;
  /** Criterion 6: the latest rebuild per student in the golden cohort. */
  rebuild: Readonly<{ students: number; maxDrift: number }> | null;
  /** §11 bars, counted across every golden tutoring scenario. */
  approachUnchangedAfterTwoWrong: number | null;
  lowConfidenceAffectAsFact: number | null;
}>;

/** Human observations, one row each, child ids only — never names. */
export type HumanEvidence = Readonly<{
  welcomeConfirmations: readonly Observation<{ childId: string; welcomeWasTrue: boolean }>[];
  briefReviews: readonly Observation<{ briefId: string; unsupportedClaims: number }>[];
  corrections: readonly Observation<{ childId: string; reflectedNextSession: boolean }>[];
  checkInRatings: readonly Observation<{ transcriptId: string; warmAndAppropriate: boolean }>[];
  protocolChildren: readonly Observation<{ childId: string; band: Band; weeksOfUse: number }>[];
}>;

export type Observation<T> = Readonly<T & { recordedAt: string }>;

export type Band = 'early' | 'middle' | 'senior';

export type CriterionId =
  | 'opens-knowing-child'
  | 'no-invented-facts'
  | 'claims-link-to-evidence'
  | 'correction-next-session'
  | 'adapts-without-label'
  | 'rebuild-drift'
  | 'bar-approach-changes'
  | 'bar-affect-not-fact'
  | 'human-protocol';

export type CriterionStatus = 'passed' | 'failed' | 'missing' | 'insufficient_sample';

export type CriterionResult = Readonly<{
  id: CriterionId;
  title: string;
  status: CriterionStatus;
  /** Why, in a sentence a reviewer can act on. */
  detail: string;
}>;

export type Phase3ExitReport = Readonly<{
  passed: boolean;
  evaluatedAt: string;
  results: readonly CriterionResult[];
}>;
