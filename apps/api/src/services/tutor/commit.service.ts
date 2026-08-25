import type { CommittedTurn } from '@aria/tutor';

import { withTransaction } from '@/db/transaction';
import type { Clock } from '@/lib/clock';
import type { MoveOutboxRepository } from '@/repositories/move-outbox.repository';
import type { SessionEventRepository } from '@/repositories/session-event.repository';
import type { SessionRepository } from '@/repositories/session.repository';
import {
  misconceptionRuntimeId,
  type SkillStateRepository,
} from '@/repositories/skill-state.repository';
import type { NewSessionEvent, SessionEndReason } from '@/types/session';

import type { Pool } from 'pg';

export type TurnCommitService = Readonly<{ commit(turn: CommittedTurn): Promise<void> }>;

export function createTurnCommitService(deps: {
  pool: Pool;
  events: SessionEventRepository;
  skills: SkillStateRepository;
  sessions: SessionRepository;
  clock: Clock;
  outbox?: MoveOutboxRepository;
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
  const skills = deps.skills.withDb(tx);
  await events.append(inputRecord(turn, sessionId, deps.clock));
  for (const move of turn.moves) {
    await events.append(moveRecord(turn, move, sessionId, deps.clock));
    await deps.outbox?.withDb(tx).enqueueIfOpen(sessionId, move);
  }
  if (turn.decision.graded !== null && turn.plan.skillCode !== null) {
    await skills.recordAttempt({
      studentId: (await requireSession(deps.sessions.withDb(tx), sessionId)).studentId,
      skillCode: turn.plan.skillCode,
      correct: turn.decision.graded.correct,
    });
    if (turn.decision.graded.misconception !== null) {
      await skills.recordMisconception(
        (await requireSession(deps.sessions.withDb(tx), sessionId)).studentId,
        misconceptionRuntimeId(turn.decision.graded.misconception),
      );
    }
  }
  if (turn.decision.terminal) {
    await deps.sessions.withDb(tx).end(sessionId, endReason(turn), deps.clock.now());
  }
}

function inputRecord(turn: CommittedTurn, sessionId: string, clock: Clock): NewSessionEvent {
  return {
    sessionId,
    actor: 'child',
    kind: turn.event.kind,
    text: eventText(turn),
    skillCode: turn.plan.skillCode,
    correct: turn.decision.graded?.correct ?? null,
    latencyMs: turn.event.kind === 'ANSWER' ? (turn.event.elapsedMs ?? null) : null,
    evidence: {
      decision: turn.plan.reason,
      ...turn.plan.evidence,
      ...(turn.decision.graded?.misconception === null || turn.decision.graded === null
        ? {}
        : { misconception: turn.decision.graded.misconception }),
    },
    payload: turn.event,
    at: clock.now(),
  };
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
