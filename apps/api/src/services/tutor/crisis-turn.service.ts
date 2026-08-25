import type { TutorInputEvent, TutorMove } from '@aria/shared';

import { withTransaction } from '@/db';
import type { Clock } from '@/lib/clock';
import type { Logger } from '@/lib/logger';
import type { QualityGate } from '@/quality';
import type { SafetyFlagRepository } from '@/repositories/safety-flag.repository';
import type { SessionEventRepository } from '@/repositories/session-event.repository';
import { detectCrisis, type CrisisDetection } from '@/safety/crisis/detect';
import { escalate, type EscalationPort } from '@/safety/crisis/escalate';
import { ESCALATION_MATRIX } from '@/safety/crisis/matrix';
import { fixedCrisisResponse } from '@/safety/crisis/respond';
import type { MoveFactory } from '@/services/moves/move-factory';

import type { Pool } from 'pg';

export type CrisisTurnService = Readonly<{
  handle(studentId: string, event: TutorInputEvent): Promise<readonly TutorMove[] | null>;
}>;

export function createCrisisTurnService(deps: {
  pool: Pool;
  events: SessionEventRepository;
  flags: SafetyFlagRepository;
  escalation: EscalationPort;
  gate: QualityGate;
  moves(sessionId: string): MoveFactory;
  clock: Clock;
  logger: Logger;
}): CrisisTurnService {
  return { handle: (studentId, event) => handle(deps, studentId, event) };
}

async function handle(
  deps: Parameters<typeof createCrisisTurnService>[0],
  studentId: string,
  event: TutorInputEvent,
): Promise<readonly TutorMove[] | null> {
  const safetyInput = childSafetyInput(event);
  if (safetyInput === null || event.sessionId === undefined) return null;
  const detection = detectCrisis(safetyInput);
  if (detection.kind === 'none') return null;
  const text = safetyInput.text;
  const response = fixedCrisisResponse(detection);
  assertGated(deps.gate, response);
  const move = deps.moves(event.sessionId).make({
    kind: 'SAY',
    speech: { text: response },
    display: [{ type: 'text', body: response, markdown: false }],
    expects: 'none',
  });
  const route =
    detection.kind === 'uncertain'
      ? null
      : await tryEscalate(deps, studentId, event.sessionId, detection.category);
  await recordCrisis(deps, {
    studentId,
    event: { ...event, sessionId: event.sessionId },
    detection,
    text,
    response,
    move,
    route,
  });
  return [move];
}

async function recordCrisis(
  deps: Parameters<typeof createCrisisTurnService>[0],
  input: Readonly<{
    studentId: string;
    event: TutorInputEvent & Readonly<{ sessionId: string }>;
    detection: Exclude<CrisisDetection, Readonly<{ kind: 'none' }>>;
    text: string;
    response: string;
    move: TutorMove;
    route: Awaited<ReturnType<typeof escalate>> | null;
  }>,
): Promise<void> {
  await withTransaction(deps.pool, async (tx) => {
    const events = deps.events.withDb(tx);
    const inputRecord = await events.append({
      sessionId: input.event.sessionId,
      actor: 'child',
      kind: input.event.kind,
      text: input.text,
      skillCode: null,
      correct: null,
      latencyMs: null,
      evidence: { safety: input.detection.kind },
      payload: input.event,
      at: deps.clock.now(),
    });
    await deps.flags.withDb(tx).insert({
      studentId: input.studentId,
      sessionId: input.event.sessionId,
      eventId: inputRecord.id,
      category: input.detection.category,
      severity: ESCALATION_MATRIX[input.detection.category].severity,
      text: input.text,
      escalatedAt: input.route === null ? null : deps.clock.now(),
      escalationRoute: input.route,
      needsReview: input.detection.kind === 'uncertain' || input.route === null,
    });
    await events.append({
      sessionId: input.event.sessionId,
      actor: 'aria',
      kind: input.move.kind,
      text: input.response,
      skillCode: null,
      correct: null,
      latencyMs: null,
      evidence: { safety: input.detection.category },
      payload: input.move,
      at: deps.clock.now(),
    });
  });
}

async function tryEscalate(
  deps: Parameters<typeof createCrisisTurnService>[0],
  studentId: string,
  sessionId: string,
  category: Parameters<typeof escalate>[1]['category'],
): Promise<Awaited<ReturnType<typeof escalate>> | null> {
  try {
    return await escalate(deps.escalation, { studentId, sessionId, category });
  } catch (error) {
    deps.logger.error({ err: error, sessionId, category }, 'Safeguarding escalation failed');
    return null;
  }
}

function childSafetyInput(event: TutorInputEvent): Readonly<{
  text: string;
  confidence?: number;
  alternatives?: readonly Readonly<{ text: string; confidence: number }>[];
}> | null {
  if (event.kind === 'QUESTION') return { text: event.text };
  if (event.kind === 'SPEECH_FINAL')
    return {
      text: event.text,
      ...(event.confidence === undefined ? {} : { confidence: event.confidence }),
      ...(event.alternatives === undefined ? {} : { alternatives: event.alternatives }),
    };
  if (event.kind === 'ANSWER' && event.text !== undefined) return { text: event.text };
  return null;
}

function assertGated(gate: QualityGate, text: string): void {
  const result = gate({
    id: 'fixed-crisis-response',
    kind: 'text',
    band: 'early',
    childText: text,
    factual: false,
    grounding: 'reviewed-bank',
  });
  if (result.verdict === 'fail') throw new Error('Fixed crisis response failed the quality gate');
}
