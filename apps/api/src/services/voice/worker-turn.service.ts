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
      if (input.authorizeOnly) {
        return { connectionEpoch: input.connectionEpoch, moves: [] };
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
          evidence: truncation(input),
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

/**
 * P2H-07: what the child heard before they talked over Aria.
 *
 * The worker knows, because it is the thing that stopped speaking. Writing it on the event that
 * interrupted keeps the transcript honest: the stored move is the whole answer Aria wrote, and
 * `truncatedAt` is how far into it anybody actually got.
 */
function truncation(input: VoiceTurnRequest): Readonly<Record<string, string | number>> {
  const prefix = input.spokenPrefix;
  if (prefix === undefined) return {};
  // `index` is the position of the last sentence spoken; `truncatedAt` is how many the child
  // heard, so "interrupted after segment 2 of 5" reads as 2 rather than 1.
  return { generationId: prefix.generationId, truncatedAt: prefix.index + 1 };
}
