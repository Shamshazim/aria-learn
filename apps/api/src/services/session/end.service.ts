import { ForbiddenError, NotFoundError } from '@/errors';
import type { Clock } from '@/lib/clock';
import type { Logger } from '@/lib/logger';
import type { SessionRepository } from '@/repositories/session.repository';
import type { ConsolidationService } from '@/services/memory/consolidate.service';
import type { SessionEndReason, TutorSessionRecord } from '@/types/session';

export type EndService = Readonly<{
  end(
    input: Readonly<{ sessionId: string; studentId: string; reason: SessionEndReason }>,
  ): Promise<TutorSessionRecord | null>;
}>;

export function createEndService(deps: {
  sessions: SessionRepository;
  consolidation: ConsolidationService;
  clock: Clock;
  logger: Logger;
  schedule(task: () => Promise<void>): void;
  cancelAhead(sessionId: string): void;
}): EndService {
  return {
    end: async (
      input: Readonly<{ sessionId: string; studentId: string; reason: SessionEndReason }>,
    ) => {
      const session = await deps.sessions.findById(input.sessionId);
      if (session === null) throw new NotFoundError('session not found');
      if (session.studentId !== input.studentId)
        throw new ForbiddenError('session ownership mismatch');
      if (session.endedAt !== null) return session;
      const ended = await deps.sessions.end(session.id, input.reason, deps.clock.now());
      if (ended !== null) {
        deps.cancelAhead(ended.id);
        scheduleConsolidation(deps, ended);
      }
      return ended;
    },
  };
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
