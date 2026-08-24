/** Public surface for replaying and reviewing multi-turn tutoring scenarios. */
export { checkTutoringInvariants, INVARIANT_RULES } from '@/testing/tutoring/assertions/invariants';
export type {
  InvariantCode,
  InvariantFinding,
  InvariantReport,
} from '@/testing/tutoring/assertions/invariants';
export { createScriptedTutor, replayScenario } from '@/testing/tutoring/replay';
export type { ReplayClock, TutorImplementation, TutorTurnResult } from '@/testing/tutoring/replay';
export { runTutoringGoldenSet } from '@/testing/tutoring/run';
export type { GoldenRunOptions, GoldenRunReport, TutorFactory } from '@/testing/tutoring/run';
export {
  loadTutoringScenarios,
  parseTutoringScenario,
  tutoringScenarioSchema,
  turnEvidenceSchema,
} from '@/testing/tutoring/scenario';
export type { TurnEvidence, TutoringScenario } from '@/testing/tutoring/scenario';
export { formatTranscript } from '@/testing/tutoring/transcript';
export type { TranscriptTurn, TutoringTranscript } from '@/testing/tutoring/transcript';
