export { createTutorHarness } from './turn.service';
export { allowedMovesFor } from './policy/allowed-moves';
export { createTeachingPolicy } from './policy/teaching-policy';
export { silenceRung } from './policy/silence-ladder';
export { shouldArmSilenceTimer, silenceWindowMs } from './policy/silence-timer';
export type { SilenceArmInput } from './policy/silence-timer';
export { classifyIntent } from './intent/rules';
export { INTENTS } from './intent/intent.types';
export type { Intent, IntentHints, IntentResult } from './intent/intent.types';
export type {
  CommittedTurn,
  LoadedTurnContext,
  MovePlan,
  PlannedTurn,
  PolicyDecision,
  ResolvedContent,
  SessionSnapshot,
  SpeculativeTurn,
  TutorHarness,
  TutorPorts,
} from './types';
