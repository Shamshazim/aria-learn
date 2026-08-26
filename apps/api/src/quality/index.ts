export { resolveGatedContent } from '@/quality/content-policy';
export type {
  ContentPolicyDependencies,
  ResolvedContent,
  VerifiedContent,
} from '@/quality/content-policy';
export { EMPTY_PRAISE, STRATEGY_CLAIMS } from '@/quality/checks/claims/claim-vocabulary.data';
export type { StrategyClaim, StrategyClaimId } from '@/quality/checks/claims/claim-vocabulary.data';
export { sentencesOf } from '@/quality/checks/level/readability';
export { registerFailures } from '@/quality/checks/level/register';
export { createQualityGate } from '@/quality/gate';
export type { QualityGate } from '@/quality/gate';
export { speakableGate } from '@/quality/speakable-gate';
export type {
  GateCheckName,
  GateCheckResult,
  GateFailureReason,
  GateInput,
  GatePass,
  GateVerdict,
  MoveClaims,
  MustMention,
  SafetyAssessment,
  SafetyChecker,
} from '@/quality/gate.types';
export { buildGateReport } from '@/quality/report/gate-report';
export type { GateReport } from '@/quality/report/gate-report';
