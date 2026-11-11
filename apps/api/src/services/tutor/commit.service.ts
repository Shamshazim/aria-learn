import type { CommittedTurn, SkillGraph } from '@aria/tutor';

import { withTransaction } from '@/db/transaction';
import type { Clock } from '@/lib/clock';
import type { MoveOutboxRepository } from '@/repositories/move-outbox.repository';
import type { SessionEventRepository } from '@/repositories/session-event.repository';
import type { SessionRepository } from '@/repositories/session.repository';
import {
  misconceptionRuntimeId,
  type SkillStateRepository,
} from '@/repositories/skill-state.repository';
import { selfCorrectionFrom } from '@/services/memory/correct/from-child';
import type { ChildCorrectionService } from '@/services/memory/correct.service';
import { recordAttempt } from '@/services/scheduler/record-attempt';
import { ENGAGEMENT_EVENT_KIND } from '@/services/tutor/engagement-context';
import type { NewSessionEvent, SessionEndReason } from '@/types/session';

import type { Pool } from 'pg';

export type TurnCommitService = Readonly<{ commit(turn: CommittedTurn): Promise<void> }>;

export function createTurnCommitService(deps: {
  pool: Pool;
  events: SessionEventRepository;
  skills: SkillStateRepository;
  sessions: SessionRepository;
  clock: Clock;
  /** P3-04: the skill graph, so an attempt knows whether its skill is a facts skill. */
  graph: SkillGraph;
  outbox?: MoveOutboxRepository;
  /** P3-06: a child's self-correction, applied in this turn's transaction. */
  corrections?: ChildCorrectionService;
}): TurnCommitService {
  return {
    commit: (turn: CommittedTurn) =>
      withTransaction(deps.pool, async (tx) => commit(deps, tx, turn)),
  };
}

async function commit(
  deps: Parameters<typeof createTurnCommitService>[0],
  tx: Parameters<Parameters<typeof withTransaction>[1]>[0],
  turn: CommittedTurn,
): Promise<void> {
  const sessionId = turn.event.sessionId;
  if (sessionId === undefined) throw new Error('Committed tutor turn has no session id');
  const events = deps.events.withDb(tx);
  await events.append(inputRecord(turn, sessionId, deps.clock));
  for (const move of turn.moves) {
    await events.append(moveRecord(turn, move, sessionId, deps.clock));
    await deps.outbox?.withDb(tx).enqueueIfOpen(sessionId, move);
  }
  const engagement = engagementRecord(turn, sessionId, deps.clock);
  if (engagement !== null) await events.append(engagement);
  const practised = practisedSkill(turn);
  await recordGraded(deps, tx, turn, sessionId);
  await recordSelfCorrection(deps, tx, turn, sessionId);
  // A SWITCH names where the lesson goes next. Writing it on the session is what makes the
  // next turn load the new skill; before this the tutor announced a change of step and then
  // kept asking about the old one.
  if (
    turn.plan.kind === 'SWITCH' &&
    turn.plan.skillCode !== null &&
    turn.plan.skillCode !== practised
  ) {
    await deps.sessions.withDb(tx).updatePlan(sessionId, { skillCode: turn.plan.skillCode });
  }
  if (turn.decision.terminal) {
    await deps.sessions.withDb(tx).end(sessionId, endReason(turn), deps.clock.now());
  }
}

/**
 * P3-06: "I don't like trucks anymore". The acknowledgement is already in the moves; the
 * change goes in with them, so the next turn's memory read has it.
 */
async function recordSelfCorrection(
  deps: Parameters<typeof createTurnCommitService>[0],
  tx: Parameters<Parameters<typeof withTransaction>[1]>[0],
  turn: CommittedTurn,
  sessionId: string,
): Promise<void> {
  const correction = selfCorrectionFrom(turn.plan.evidence ?? {});
  if (correction === null || deps.corrections === undefined) return;
  const { studentId } = await requireSession(deps.sessions.withDb(tx), sessionId);
  await deps.corrections.fromChild(tx, { studentId, correction });
}

/** The graded answer, through the scheduler, and the misconception it showed, if any. */
async function recordGraded(
  deps: Parameters<typeof createTurnCommitService>[0],
  tx: Parameters<Parameters<typeof withTransaction>[1]>[0],
  turn: CommittedTurn,
  sessionId: string,
): Promise<void> {
  const graded = turn.decision.graded;
  const practised = practisedSkill(turn);
  if (graded === null || practised === null) return;
  const skills = deps.skills.withDb(tx);
  const { studentId } = await requireSession(deps.sessions.withDb(tx), sessionId);
  await recordAttempt(skills, deps.graph, {
    studentId,
    skillCode: practised,
    correct: graded.correct,
    latencyMs: turn.event.kind === 'ANSWER' ? (turn.event.elapsedMs ?? null) : null,
    at: deps.clock.now(),
  });
  if (graded.misconception !== null) {
    await skills.recordMisconception(studentId, misconceptionRuntimeId(graded.misconception));
  }
}

/**
 * P2H-05: what a child said when they volunteered personal information is never written down.
 *
 * Not redacted field by field — replaced. The row still exists, so the turn is auditable and
 * the count is honest, but the address itself stops at the policy that recognised it.
 */
export const PERSONAL_INFO_MARKER = '[redacted: personal-info]';

function inputRecord(turn: CommittedTurn, sessionId: string, clock: Clock): NewSessionEvent {
  const redacted = turn.plan.evidence?.personalInfoRedacted === true;
  return {
    sessionId,
    actor: 'child',
    kind: turn.event.kind,
    text: redacted ? PERSONAL_INFO_MARKER : eventText(turn),
    // What the child answered *about*: a SWITCH plan names where the lesson goes next, and an
    // answer filed under that skill would count a wrong answer against the step back (P3-04).
    skillCode: practisedSkill(turn),
    correct: turn.decision.graded?.correct ?? null,
    latencyMs: turn.event.kind === 'ANSWER' ? (turn.event.elapsedMs ?? null) : null,
    evidence: {
      decision: turn.plan.reason,
      ...turn.plan.evidence,
      ...(turn.decision.graded?.misconception === null || turn.decision.graded === null
        ? {}
        : { misconception: turn.decision.graded.misconception }),
    },
    payload: redacted ? redactedPayload(turn) : turn.event,
    at: clock.now(),
  };
}

/** The stored payload keeps the event's shape and identity, never its words. */
function redactedPayload(turn: CommittedTurn): Readonly<Record<string, unknown>> {
  const { id, at, protocolVersion, kind } = turn.event;
  return { id, at, protocolVersion, kind, redacted: 'personal-info' };
}

function moveRecord(
  turn: CommittedTurn,
  move: CommittedTurn['moves'][number],
  sessionId: string,
  clock: Clock,
): NewSessionEvent {
  return {
    sessionId,
    actor: 'aria',
    kind: move.kind,
    text: move.speech?.text ?? null,
    skillCode: turn.plan.skillCode,
    correct: null,
    latencyMs: turn.spans.e2e_ms ?? null,
    evidence: {
      ...turn.privateEvidence,
      ...turn.plan.evidence,
      approach: turn.plan.approach,
      reason: turn.plan.reason,
      spans: turn.spans,
    },
    payload: move,
    at: clock.now(),
  };
}

/**
 * P3-05: one row per engagement inference — the signals, the confidence and what was done —
 * so a false one can be counted later ("I'm fine" after a tired check-in is a false positive).
 * Written only when the policy says the state or the response changed.
 */
function engagementRecord(
  turn: CommittedTurn,
  sessionId: string,
  clock: Clock,
): NewSessionEvent | null {
  const evidence = turn.plan.evidence ?? {};
  if (evidence.engagementChanged !== true) return null;
  const fields = Object.fromEntries(
    Object.entries(evidence).filter(([key]) => key.startsWith('engagement')),
  );
  return {
    sessionId,
    actor: 'system',
    kind: ENGAGEMENT_EVENT_KIND,
    text: null,
    skillCode: practisedSkill(turn),
    correct: null,
    latencyMs: null,
    evidence: { ...fields, trigger: turn.event.kind },
    payload: {},
    at: clock.now(),
  };
}

function practisedSkill(turn: CommittedTurn): string | null {
  return turn.practisedSkillCode ?? turn.plan.skillCode;
}

async function requireSession(repository: SessionRepository, id: string) {
  const session = await repository.findById(id);
  if (session === null) throw new Error('Session disappeared during turn commit');
  return session;
}

function eventText(turn: CommittedTurn): string | null {
  const event = turn.event;
  if (event.kind === 'ANSWER') return event.text ?? event.choiceId ?? null;
  if (event.kind === 'QUESTION' || event.kind === 'SPEECH_FINAL' || event.kind === 'SPEECH_PARTIAL')
    return event.text;
  return null;
}

function endReason(turn: CommittedTurn): SessionEndReason {
  if (turn.event.kind === 'LEAVE') return 'child_left';
  if (turn.plan.kind === 'BREAK') return 'break';
  if (turn.plan.reason === 'The age-band session limit was reached.') return 'timeout';
  return 'complete';
}
