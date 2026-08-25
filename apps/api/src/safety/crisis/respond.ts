import type { CrisisDetection } from '@/safety/crisis/detect';
import { ESCALATION_MATRIX, UNCERTAIN_HIGH_RISK_RESPONSE } from '@/safety/crisis/matrix';

export function fixedCrisisResponse(detection: Exclude<CrisisDetection, { kind: 'none' }>): string {
  return detection.kind === 'uncertain'
    ? UNCERTAIN_HIGH_RISK_RESPONSE
    : ESCALATION_MATRIX[detection.category].response;
}
