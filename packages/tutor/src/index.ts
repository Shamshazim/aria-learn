export { createTutorHarness } from './turn.service';
export { allowedMovesFor } from './policy/allowed-moves';
export { approachesFor, PLANNER_APPROACHES } from './policy/approaches';
export { createTeachingPolicy } from './policy/teaching-policy';
export { silenceRung } from './policy/silence-ladder';
export { shouldArmSilenceTimer, silenceWindowMs } from './policy/silence-timer';
export type { SilenceArmInput } from './policy/silence-timer';
export { classifyIntent } from './intent/rules';
export { INTENTS, MODEL_PASS_CONFIDENCE } from './intent/intent.types';
export { PERSONAL_INFO_PATTERNS } from './intent/personal-info.patterns';
export type { Intent, IntentHints, IntentResult } from './intent/intent.types';
export type {
  CommittedTurn,
  LoadedTurnContext,
  MovePlan,
  PlannedTurn,
  PlannerObservation,
  PlanSource,
  PolicyDecision,
  ResolvedContent,
  SessionSnapshot,
  SpeculativeTurn,
  TutorHarness,
  TutorPorts,
} from './types';
