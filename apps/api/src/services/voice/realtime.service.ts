import { tutorMoveSchema } from '@aria/shared';

import { ForbiddenError, NotFoundError, ServiceUnavailableError, ValidationError } from '@/errors';
import type { Clock } from '@/lib/clock';
import type { MoveOutboxRepository } from '@/repositories/move-outbox.repository';
import type { SessionEventRepository } from '@/repositories/session-event.repository';
import type { SessionRepository } from '@/repositories/session.repository';
import type { VoiceConsentRepository } from '@/repositories/voice-consent.repository';
import type { VoiceSessionRepository } from '@/repositories/voice-session.repository';
import type { RealtimeCredentials } from '@/types/voice';

const TOKEN_TTL_SECONDS = 300;

export type RealtimeTokenProvider = Readonly<{
  mint(
    input: Readonly<{
      identity: string;
      room: string;
      ttlSeconds: number;
      metadata: Readonly<Record<string, string | number>>;
    }>,
  ): Promise<string>;
}>;

export function createRealtimeService(deps: {
  sessions: Pick<SessionRepository, 'findById'>;
  consent: Pick<VoiceConsentRepository, 'findGranted'>;
  voiceSessions: Pick<VoiceSessionRepository, 'open'>;
  events: Pick<SessionEventRepository, 'list'>;
  outbox: Pick<MoveOutboxRepository, 'enqueueIfOpen'>;
  tokens: RealtimeTokenProvider;
  clock: Clock;
  livekitUrl: string;
  region: string;
  processors: Readonly<Record<string, string>>;
}): Readonly<{ negotiate(studentId: string, sessionId: string): Promise<RealtimeCredentials> }> {
  return { negotiate: (studentId, sessionId) => negotiate(deps, studentId, sessionId) };
}

async function negotiate(
  deps: Parameters<typeof createRealtimeService>[0],
  studentId: string,
  sessionId: string,
): Promise<RealtimeCredentials> {
  const session = await deps.sessions.findById(sessionId);
  if (session === null) throw new NotFoundError('session not found');
  if (session.studentId !== studentId)
    throw new ForbiddenError('student session ownership mismatch');
  if (session.endedAt !== null) throw new ValidationError('session has already ended');
  const consent = await deps.consent.findGranted(studentId);
  if (consent === null) throw new ForbiddenError('verified parental voice consent is required');
  const configured = Object.keys(deps.processors);
  if (!configured.every((processor) => consent.processorCategories.includes(processor))) {
    throw new ForbiddenError('voice consent does not cover the configured processors');
  }
  if (configured.length === 0)
    throw new ServiceUnavailableError('voice processors are not configured');
  const connectionEpoch = await deps.voiceSessions.open({
    sessionId,
    region: deps.region,
    processorMap: deps.processors,
  });
  const events = await deps.events.list(sessionId);
  const latestMove = events.findLast((event) => tutorMoveSchema.safeParse(event.payload).success);
  if (latestMove !== undefined) {
    await deps.outbox.enqueueIfOpen(sessionId, tutorMoveSchema.parse(latestMove.payload));
  }
  const room = `aria_${sessionId}`;
  const expiresAt = new Date(deps.clock.now().getTime() + TOKEN_TTL_SECONDS * 1_000);
  const token = await deps.tokens.mint({
    identity: `student_${studentId}`,
    room,
    ttlSeconds: TOKEN_TTL_SECONDS,
    metadata: { sessionId, connectionEpoch, band: session.band },
  });
  return {
    url: deps.livekitUrl,
    token,
    room,
    region: deps.region,
    expiresAt: expiresAt.toISOString(),
    processors: configured,
    connectionEpoch,
  };
}
