export type FactEvidence = Readonly<{
  /** `correction`: the fact exists because a parent or the child corrected one (P3-06). */
  sourceKind: 'session_event' | 'parent_correction' | 'observation' | 'correction';
  sourceId: string;
}>;

export type LearnerFact = Readonly<{
  id: string;
  studentId: string;
  kind: string;
  value: Readonly<Record<string, unknown>>;
  confidence: number;
  firstObservedAt: Date;
  lastConfirmedAt: Date;
  expiresAt: Date | null;
  sensitivity: string;
  modelShareable: boolean;
  supersededBy: string | null;
  /**
   * P3-06: backed by a correction. Retrieval ranks it first and consolidation never replaces
   * it — what a parent said outranks what a session inferred. Absent where it was not read.
   */
  corrected?: boolean;
}>;

export type NewLearnerFact = Omit<LearnerFact, 'id' | 'supersededBy' | 'corrected'> &
  Readonly<{ evidence: readonly [FactEvidence, ...FactEvidence[]] }>;

export type Observation = Readonly<{
  id: string;
  studentId: string;
  at: Date;
  skillCode: string | null;
  kind: string;
  note: string | null;
  confidence: number | null;
  expiresAt: Date | null;
  sourceEventId: string | null;
}>;
