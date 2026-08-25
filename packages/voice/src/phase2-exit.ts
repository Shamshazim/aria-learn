export type Phase2ExitEvidence = Readonly<{
  independentEarlyReaderSessionPassed: boolean;
  coreSetFalseTeachingCount: number | null;
  lowConfidenceDurableUpdateCount: number | null;
  spokenTeachingHumanReviewPassed: boolean;
  voiceGoldenSetPassed: boolean;
  privacyCounselSignoffRecorded: boolean;
}>;

export type Phase2ExitReport = Readonly<{ passed: boolean; blockers: readonly string[] }>;

export function evaluatePhase2Exit(evidence: Phase2ExitEvidence): Phase2ExitReport {
  const blockers = [
    evidence.independentEarlyReaderSessionPassed
      ? null
      : 'Independent session with a five-year-old who cannot read has not passed.',
    evidence.coreSetFalseTeachingCount === 0
      ? null
      : 'The human-labelled core set has false praise or incorrect reteaching, or is missing.',
    evidence.lowConfidenceDurableUpdateCount === 0
      ? null
      : 'Low-confidence reading durable-state protection has not been proven.',
    evidence.spokenTeachingHumanReviewPassed
      ? null
      : 'Initial-scope spoken teaching has not passed human review.',
    evidence.voiceGoldenSetPassed ? null : 'The blocking voice golden set has not passed.',
    evidence.privacyCounselSignoffRecorded
      ? null
      : 'Child-audio privacy counsel sign-off is not recorded.',
  ].filter((blocker): blocker is string => blocker !== null);
  return { passed: blockers.length === 0, blockers };
}
