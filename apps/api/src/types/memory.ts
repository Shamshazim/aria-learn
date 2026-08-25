export type FactEvidence = Readonly<{
  sourceKind: 'session_event' | 'parent_correction' | 'observation';
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
}>;

export type NewLearnerFact = Omit<LearnerFact, 'id' | 'supersededBy'> &
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
