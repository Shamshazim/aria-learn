export { adapt } from './adaptation';
export { allCheckInCopy, checkInCopy, isDenial, readCheckInReply } from './check-in';
export type { CheckInCopy, CheckInOption, CheckInReply } from './check-in';
export { fold, READY } from './estimator';
export { eventSignals, gradedSignals, utteranceStatement } from './event-signals';
export type { AnswerSetting } from './event-signals';
export { statementSignal } from './statements';
export {
  ACT_CONFIDENCE,
  CHECK_IN_CONFIDENCE,
  ENGAGEMENT_THRESHOLDS,
  IDLE_MS,
  STATE_LIFETIME_MS,
  TAB_HIDDEN_MIN_MS,
} from './thresholds';
export { EMPTY_HISTORY, ENGAGEMENT_SIGNAL_NAMES } from './types';
export type {
  AdaptationDecision,
  AdaptationKind,
  EngagementContext,
  EngagementHistory,
  EngagementSignal,
  EngagementSignalName,
  EngagementState,
  OpenCheckIn,
} from './types';
