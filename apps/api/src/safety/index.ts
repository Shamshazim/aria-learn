export { createInputSafetyService } from './flag.service';
export { containsSensitiveDisclosure, detectCrisis } from './crisis/detect';
export { ESCALATION_MATRIX, UNCERTAIN_HIGH_RISK_RESPONSE } from './crisis/matrix';
export type { InputSafetyResult } from './flag.service';
export type { SafetyInput, CrisisDetection } from './crisis/detect';
export type { EscalationPort } from './crisis/escalate';
