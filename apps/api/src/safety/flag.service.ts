import type { SafetyFlagRepository } from '@/repositories/safety-flag.repository';
import { detectCrisis, type SafetyInput } from '@/safety/crisis/detect';
import { escalate, type EscalationPort } from '@/safety/crisis/escalate';
import { ESCALATION_MATRIX } from '@/safety/crisis/matrix';
import { fixedCrisisResponse } from '@/safety/crisis/respond';

export type InputSafetyResult =
  Readonly<{ safe: true }> | Readonly<{ safe: false; response: string; needsReview: boolean }>;

export type InputSafetyService = Readonly<{
  check(
    input: SafetyInput &
      Readonly<{
        studentId: string;
        sessionId: string;
        eventId: string | null;
      }>,
  ): Promise<InputSafetyResult>;
}>;

export function createInputSafetyService(deps: {
  flags: SafetyFlagRepository;
  escalation: EscalationPort;
  now(): Date;
}): InputSafetyService {
  return {
    check: (
      input: SafetyInput &
        Readonly<{ studentId: string; sessionId: string; eventId: string | null }>,
    ) => check(deps, input),
  };
}

async function check(
  deps: Parameters<typeof createInputSafetyService>[0],
  input: SafetyInput & Readonly<{ studentId: string; sessionId: string; eventId: string | null }>,
): Promise<InputSafetyResult> {
  const detection = detectCrisis(input);
  if (detection.kind === 'none') return { safe: true };
  const rule = ESCALATION_MATRIX[detection.category];
  const uncertain = detection.kind === 'uncertain';
  const route = uncertain
    ? null
    : await escalate(deps.escalation, {
        studentId: input.studentId,
        sessionId: input.sessionId,
        category: detection.category,
      });
  await deps.flags.insert({
    studentId: input.studentId,
    sessionId: input.sessionId,
    eventId: input.eventId,
    category: detection.category,
    severity: rule.severity,
    text: detection.matchedText,
    escalatedAt: route === null ? null : deps.now(),
    escalationRoute: route,
    needsReview: uncertain,
  });
  return { safe: false, response: fixedCrisisResponse(detection), needsReview: uncertain };
}
