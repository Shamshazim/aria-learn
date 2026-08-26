import { PROTOCOL_VERSION, tutorInputEventSchema } from '@aria/shared';

import type { Clock } from '@/lib/clock';
import type { IdGenerator } from '@/lib/ids';
import type { Logger } from '@/lib/logger';
import type { SessionEventRepository } from '@/repositories/session-event.repository';
import type { SessionRepository } from '@/repositories/session.repository';
import type { ChildSessionRecord } from '@/types/auth';
import type { TutorSessionRecord } from '@/types/session';

/**
 * Half an hour of silence ends the lesson (P2H-12).
 *
 * A child who wanders off leaves two things open: a session cookie that is a way back into
 * their account, and a tutor session that will otherwise still be waiting for an answer
 * tomorrow. Both are closed together, in that order, so a session cannot be resumed by a
 * cookie that has already been withdrawn.
 *
 * The transcript records a `PAUSE` before the end, because that is what happened: nobody said
 * goodbye. `timeout` is the end reason for exactly this — `child_left` is reserved for a child
 * who told us they were going.
 */
export type IdleExpiryService = Readonly<{
  /** Ends the tutor session belonging to a child session that has just been revoked. */
  endFor(session: ChildSessionRecord): Promise<void>;
  /** Every session that went idle without anybody asking. Returns how many it ended. */
  sweep(): Promise<number>;
}>;

/** One sweep never ends more than this, so a backlog cannot become one enormous transaction. */
const SWEEP_LIMIT = 200;

function idleEvent(
  deps: Readonly<{ ids: IdGenerator; clock: Clock }>,
  sessionId: string,
  kind: 'PAUSE' | 'LEAVE',
): ReturnType<typeof tutorInputEventSchema.parse> {
  return tutorInputEventSchema.parse({
    id: deps.ids.next(),
    at: deps.clock.now().toISOString(),
    protocolVersion: PROTOCOL_VERSION,
    kind,
    sessionId,
    ...(kind === 'LEAVE' ? { reason: 'disconnected' } : {}),
  });
}

export type EndSession = (
  input: Readonly<{ sessionId: string; studentId: string; reason: 'timeout' }>,
) => Promise<TutorSessionRecord | null>;

export function createIdleExpiryService(deps: {
  childSessions: Readonly<{
    expired(): Promise<readonly ChildSessionRecord[]>;
    revoke(session: ChildSessionRecord): Promise<void>;
  }>;
  sessions: Pick<SessionRepository, 'findOpen'>;
  events: Pick<SessionEventRepository, 'append'>;
  end: EndSession;
  ids: IdGenerator;
  clock: Clock;
  logger: Pick<Logger, 'info' | 'warn'>;
}): IdleExpiryService {
  const endFor = async (childSession: ChildSessionRecord): Promise<void> => {
    const open = await deps.sessions.findOpen(childSession.studentId);
    if (open === null) return;
    // The two events the protocol already has for this, in the order they happened: the child
    // stopped, and then they were gone. A transcript that jumped straight to an ended session
    // would read as though Aria closed it.
    for (const kind of ['PAUSE', 'LEAVE'] as const) {
      await deps.events.append({
        sessionId: open.id,
        actor: 'system',
        kind,
        text: null,
        skillCode: null,
        correct: null,
        latencyMs: null,
        evidence: { reason: 'idle_timeout' },
        payload: idleEvent(deps, open.id, kind),
        at: deps.clock.now(),
      });
    }
    await deps.end({ sessionId: open.id, studentId: childSession.studentId, reason: 'timeout' });
    deps.logger.info(
      { event: 'child_session_idle_expired', sessionId: open.id },
      'A session was ended after half an hour with nobody in it',
    );
  };

  return { endFor, sweep: () => sweep(deps, endFor) };
}

async function sweep(
  deps: Parameters<typeof createIdleExpiryService>[0],
  endFor: (session: ChildSessionRecord) => Promise<void>,
): Promise<number> {
  const expired = await deps.childSessions.expired();
  let ended = 0;
  for (const childSession of expired.slice(0, SWEEP_LIMIT)) {
    try {
      await deps.childSessions.revoke(childSession);
      await endFor(childSession);
      ended += 1;
    } catch (error) {
      // One family's stuck session must not stop the rest of the sweep.
      deps.logger.warn(
        { err: error, event: 'child_session_sweep_failed' },
        'Could not end an idle session; it stays live until the next sweep',
      );
    }
  }
  return ended;
}
