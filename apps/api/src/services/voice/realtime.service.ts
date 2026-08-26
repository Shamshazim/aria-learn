import { tutorMoveSchema, voiceRoomName } from '@aria/shared';
import type { PronunciationHints } from '@aria/voice';

import type { Queryable } from '@/db/types';
import { ForbiddenError, NotFoundError, ServiceUnavailableError, ValidationError } from '@/errors';
import type { Clock } from '@/lib/clock';
import type { MoveOutboxRepository } from '@/repositories/move-outbox.repository';
import type { SessionEventRepository } from '@/repositories/session-event.repository';
import type { SessionRepository } from '@/repositories/session.repository';
import type { VoiceConsentRepository } from '@/repositories/voice-consent.repository';
import type { VoiceLifecycleRepository } from '@/repositories/voice-lifecycle.repository';
import type { VoiceSessionRepository } from '@/repositories/voice-session.repository';
import type { RealtimeCredentials } from '@/types/voice';

const TOKEN_TTL_SECONDS = 300;

/**
 * P2H-08: how this child's name is said, if anyone has told us.
 *
 * A port rather than a query, because the field it reads — `student.settings.pronunciation` —
 * belongs to the profile and not to a voice session. P2H-12 supplies the implementation that
 * reads it; a deployment with nothing in the profile still gets `NO_PRONUNCIATION_HINTS` and
 * sends no hints at all.
 */
export type PronunciationSource = Readonly<{
  forStudent(studentId: string): Promise<PronunciationHints>;
}>;

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

type Rebindable<T> = T & Readonly<{ withDb(db: Queryable): T }>;

export function createRealtimeService(deps: {
  sessions: Pick<SessionRepository, 'findById'>;
  consent: Rebindable<Pick<VoiceConsentRepository, 'findGranted'>>;
  voiceSessions: Rebindable<Pick<VoiceSessionRepository, 'rotate'>>;
  lifecycle: VoiceLifecycleRepository;
  events: Rebindable<Pick<SessionEventRepository, 'list'>>;
  outbox: Rebindable<Pick<MoveOutboxRepository, 'enqueueIfOpen'>>;
  rooms: Readonly<{ close(roomName: string): Promise<void> }>;
  tokens: RealtimeTokenProvider;
  pronunciation: PronunciationSource;
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
  return deps.lifecycle.exclusive(studentId, (db) =>
    negotiateExclusive(deps, session, studentId, db),
  );
}

async function negotiateExclusive(
  deps: Parameters<typeof createRealtimeService>[0],
  session: NonNullable<Awaited<ReturnType<SessionRepository['findById']>>>,
  studentId: string,
  db: Queryable,
): Promise<RealtimeCredentials> {
  const consent = await deps.consent.withDb(db).findGranted(studentId);
  if (consent === null) throw new ForbiddenError('verified parental voice consent is required');
  const configured = Object.keys(deps.processors);
  if (!configured.every((processor) => consent.processorCategories.includes(processor))) {
    throw new ForbiddenError('voice consent does not cover the configured processors');
  }
  if (configured.length === 0)
    throw new ServiceUnavailableError('voice processors are not configured');
  const rotation = await deps.voiceSessions.withDb(db).rotate({
    sessionId: session.id,
    region: deps.region,
    processorMap: deps.processors,
  });
  if (rotation === null) throw new ValidationError('session has already ended');
  if (rotation.previousEpoch !== null) {
    await deps.rooms.close(voiceRoomName(session.id, rotation.previousEpoch));
  }
  const connectionEpoch = rotation.connectionEpoch;
  const events = await deps.events.withDb(db).list(session.id);
  const latestMove = events.findLast((event) => tutorMoveSchema.safeParse(event.payload).success);
  if (latestMove !== undefined) {
    await deps.outbox
      .withDb(db)
      .enqueueIfOpen(session.id, tutorMoveSchema.parse(latestMove.payload));
  }
  const room = voiceRoomName(session.id, connectionEpoch);
  const expiresAt = new Date(deps.clock.now().getTime() + TOKEN_TTL_SECONDS * 1_000);
  // Token metadata is flat, so the hints travel as JSON and are absent when there are none.
  const hints = await deps.pronunciation.forStudent(studentId);
  const token = await deps.tokens.mint({
    identity: `student_${studentId}`,
    room,
    ttlSeconds: TOKEN_TTL_SECONDS,
    metadata: {
      sessionId: session.id,
      connectionEpoch,
      band: session.band,
      ...(Object.keys(hints).length === 0 ? {} : { pronunciation: JSON.stringify(hints) }),
    },
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
