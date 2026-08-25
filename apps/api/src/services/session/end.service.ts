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
      if (ended !== null) {
        await deps.closeVoiceSession?.(ended.id, endedAt);
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
