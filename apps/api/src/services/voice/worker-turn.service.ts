import {
  PROTOCOL_VERSION,
  sessionIdSchema,
  type TurnRequest,
  type VoiceTurnRequest,
  type VoiceTurnResponse,
} from '@aria/shared';

import { ForbiddenError, NotFoundError, ValidationError } from '@/errors';
import type { Clock } from '@/lib/clock';
import type { MoveOutboxRepository } from '@/repositories/move-outbox.repository';
import type { SessionEventRepository } from '@/repositories/session-event.repository';
import type { SessionRepository } from '@/repositories/session.repository';
import type { VoiceSessionRepository } from '@/repositories/voice-session.repository';

export function createWorkerTurnService(deps: {
  sessions: Pick<SessionRepository, 'findById'>;
  voiceSessions: Pick<VoiceSessionRepository, 'findOpen'>;
  outbox: Pick<MoveOutboxRepository, 'acknowledge' | 'listAfter'>;
  events: Pick<SessionEventRepository, 'append'>;
  turn(studentId: string, request: TurnRequest, signal?: AbortSignal): Promise<unknown>;
  clock: Clock;
}): Readonly<{
  handle(
    sessionId: string,
    input: VoiceTurnRequest,
    signal?: AbortSignal,
  ): Promise<VoiceTurnResponse>;
}> {
  return {
    handle: async (sessionId, input, signal) => {
      const protocolSessionId = sessionIdSchema.parse(sessionId);
      const session = await deps.sessions.findById(sessionId);
      if (session === null) throw new NotFoundError('session not found');
      const voice = await deps.voiceSessions.findOpen(sessionId);
      if (voice === null) throw new ForbiddenError('voice session is not open');
      if (voice.connectionEpoch !== input.connectionEpoch) {
        throw new ValidationError('stale voice connection epoch');
      }
      if (input.event.sessionId !== undefined && input.event.sessionId !== protocolSessionId) {
        throw new ValidationError('voice event session id does not match the room');
      }
      await deps.outbox.acknowledge(sessionId, input.acknowledgedSeq, deps.clock.now());
      if (input.event.kind === 'BACKCHANNEL' || input.event.kind === 'SPEECH_STARTED') {
        await deps.events.append({
          sessionId,
          actor: 'child',
          kind: input.event.kind,
          text: null,
          skillCode: null,
          correct: null,
          latencyMs: null,
          evidence: {},
          payload: { ...input.event, sessionId: protocolSessionId },
          at: deps.clock.now(),
        });
      } else if (!input.replayOnly) {
        await deps.turn(
          session.studentId,
          {
            protocolVersion: PROTOCOL_VERSION,
            sessionId: protocolSessionId,
            event: { ...input.event, sessionId: protocolSessionId },
          },
          signal,
        );
      }
      const replay = await deps.outbox.listAfter(sessionId, input.acknowledgedSeq);
      return { connectionEpoch: input.connectionEpoch, moves: replay.map((item) => item.move) };
    },
  };
}
