export type InvariantCode =
  | 'ADAPTATION_MISSING'
  | 'AFFECT_STATED_AS_FACT'
  | 'CORRECTED_FACT_ASSERTED'
  | 'STATE_LABEL_ASSERTED'
  | 'UNSUPPORTED_CLAIM'
  | 'APPROACH_NOT_CHANGED'
  | 'FACT_WITHOUT_EVIDENCE'
  | 'INTERRUPTION_NOT_STOPPED'
  | 'REVEAL_BEFORE_STEPS'
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
