import { ForbiddenError, NotFoundError } from '@/errors';
import type { Clock } from '@/lib/clock';
import type { Logger } from '@/lib/logger';
import type { SessionEventRepository } from '@/repositories/session-event.repository';
import type { SessionRepository } from '@/repositories/session.repository';
import type { ConsolidationService } from '@/services/memory/consolidate.service';
import { buildRecap } from '@/services/session/recap';
import { sessionSummary } from '@/services/session/recap-text';
import type { SessionEndReason, SessionEventRecord, TutorSessionRecord } from '@/types/session';

export type EndService = Readonly<{
  end(
    input: Readonly<{ sessionId: string; studentId: string; reason: SessionEndReason }>,
  ): Promise<TutorSessionRecord | null>;
}>;

export function createEndService(deps: {
  sessions: SessionRepository;
  /** P2H-11: read back to build the session summary that gets written down. */
  events: SessionEventRepository;
  skillName(skillCode: string): string | null;
  consolidation: ConsolidationService;
  clock: Clock;
  logger: Logger;
  schedule(task: () => Promise<void>): void;
  cancelAhead(sessionId: string): void;
  closeVoiceSession?(sessionId: string, at: Date): Promise<void>;
}): EndService {
  return {
    end: async (
      input: Readonly<{ sessionId: string; studentId: string; reason: SessionEndReason }>,
    ) => {
      const session = await deps.sessions.findById(input.sessionId);
      if (session === null) throw new NotFoundError('session not found');
      if (session.studentId !== input.studentId)
        throw new ForbiddenError('session ownership mismatch');
      const endedAt = deps.clock.now();
      if (session.endedAt !== null) {
        await deps.closeVoiceSession?.(session.id, endedAt);
        return session;
      }
      const ended = await deps.sessions.end(session.id, input.reason, endedAt);
      if (ended === null) return null;
      const summarised = await summarise(deps, ended);
      await deps.closeVoiceSession?.(summarised.id, endedAt);
      deps.cancelAhead(summarised.id);
      scheduleConsolidation(deps, summarised);
      return summarised;
    },
  };
}

/**
 * Writes down what the session came to (P2H-11).
 *
 * Aria's own ending is preferred, because that is the sentence the child heard. A session that
 * stopped without one still gets a summary built from its own events: a null row reads as
 * "nothing happened", and a child who answered three questions and closed the tab did happen.
 */
async function summarise(
  deps: Parameters<typeof createEndService>[0],
  session: TutorSessionRecord,
): Promise<TutorSessionRecord> {
  if (session.summary !== null) return session;
  const records = await deps.events.list(session.id);
  const summary = sessionSummary({
    endText: endMoveText(records),
    recap: buildRecap(records, (code) => deps.skillName(code)),
    subject: session.subject,
  });
  return (await deps.sessions.saveSummary(session.id, summary)) ?? session;
}

function endMoveText(records: readonly SessionEventRecord[]): string | null {
  const ending = [...records]
    .reverse()
    .find(
      (record) => record.actor === 'aria' && (record.kind === 'END' || record.kind === 'BREAK'),
    );
  return ending?.text ?? null;
}

function scheduleConsolidation(
  deps: Parameters<typeof createEndService>[0],
  session: TutorSessionRecord,
): void {
  deps.schedule(async () => {
    try {
      await deps.consolidation.consolidate(session.id, session.studentId);
    } catch (error) {
      deps.logger.error({ err: error, sessionId: session.id }, 'Session consolidation failed');
    }
  });
}
