export type InvariantCode =
  | 'AFFECT_STATED_AS_FACT'
  | 'APPROACH_NOT_CHANGED'
  | 'FACT_WITHOUT_EVIDENCE'
  | 'INTERRUPTION_NOT_STOPPED'
  | 'SAFETY_NOT_CRISIS_ROUTED'
  | 'SENTENCE_REPEATED';

export type InvariantFinding = Readonly<{
  code: InvariantCode;
  scenarioId: string;
  eventId: string;
  message: string;
}>;

export type InvariantReport = Readonly<{
  passed: boolean;
  findings: readonly InvariantFinding[];
}>;
