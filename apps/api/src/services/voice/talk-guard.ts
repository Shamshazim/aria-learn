import { ForbiddenError, NotFoundError, ValidationError } from '@/errors';
import type { SessionRepository } from '@/repositories/session.repository';
import type { VoiceSessionRepository } from '@/repositories/voice-session.repository';
import type { TutorSessionRecord } from '@/types/session';

export type TalkGuardDeps = Readonly<{
  sessions: Pick<SessionRepository, 'findById'>;
  voiceSessions: Pick<VoiceSessionRepository, 'findOpen'>;
}>;

/**
 * The checks every "Aria talks" request passes before it touches a session: the tutor session
 * exists and is open, a voice session is open on it, and the worker is speaking for the
 * connection epoch that is current — a worker left over from an earlier connection is refused
 * rather than allowed to write into a session another worker now owns.
 */
export async function openTalkSession(
  deps: TalkGuardDeps,
  sessionId: string,
  connectionEpoch: number,
): Promise<TutorSessionRecord> {
  const session = await deps.sessions.findById(sessionId);
  if (session === null) throw new NotFoundError('session not found');
  if (session.endedAt !== null) throw new ValidationError('session has already ended');
  const voice = await deps.voiceSessions.findOpen(sessionId);
  if (voice === null) throw new ForbiddenError('voice session is not open');
  if (voice.connectionEpoch !== connectionEpoch) {
    throw new ValidationError('stale voice connection epoch');
  }
  return session;
}
