import { voiceRoomName } from '@aria/shared';

import type { Queryable } from '@/db/types';
import { ForbiddenError, NotFoundError } from '@/errors';
import type { Clock } from '@/lib/clock';
import type { IdGenerator } from '@/lib/ids';
import type { StudentRepository } from '@/repositories/student.repository';
import type { VoiceConsentRepository } from '@/repositories/voice-consent.repository';
import type { VoiceLifecycleRepository } from '@/repositories/voice-lifecycle.repository';
import type { VoiceSessionRepository } from '@/repositories/voice-session.repository';
import type { AudioDeletionService } from '@/services/voice/audio-deletion.service';
import type { VoiceConsent } from '@/types/voice';

export type VoiceRoomCloser = Readonly<{ close(roomName: string): Promise<void> }>;
type Rebindable<T> = T & Readonly<{ withDb(db: Queryable): T }>;

export function createVoiceConsentService(deps: {
  students: Pick<StudentRepository, 'findById'>;
  consent: Rebindable<Pick<VoiceConsentRepository, 'grant' | 'withdraw'>>;
  sessions: Rebindable<Pick<VoiceSessionRepository, 'closeForStudent'>>;
  lifecycle: VoiceLifecycleRepository;
  deletion: AudioDeletionService;
  rooms: VoiceRoomCloser;
  ids: IdGenerator;
  clock: Clock;
}): Readonly<{
  grant(
    input: Readonly<{
      parentId: string;
      studentId: string;
      processorCategories: readonly string[];
      retainReadingAudio: boolean;
      verificationReference: string;
    }>,
  ): Promise<VoiceConsent>;
  withdraw(parentId: string, studentId: string): Promise<boolean>;
}> {
  const requireRelationship = async (parentId: string, studentId: string): Promise<void> => {
    const student = await deps.students.findById(studentId);
    if (student === null) throw new NotFoundError('student not found');
    if (student.parentId !== parentId) throw new ForbiddenError('parent and student do not match');
  };
  return {
    grant: async (input) => {
      await requireRelationship(input.parentId, input.studentId);
      return deps.consent.grant({ ...input, id: deps.ids.next(), at: deps.clock.now() });
    },
    withdraw: async (parentId, studentId) => {
      await requireRelationship(parentId, studentId);
      const { at, withdrawn, sessions } = await deps.lifecycle.exclusive(studentId, async (db) => {
        const at = deps.clock.now();
        const withdrawn = await deps.consent.withDb(db).withdraw(studentId, at);
        const sessions = await deps.sessions.withDb(db).closeForStudent(studentId, at);
        return { at, withdrawn, sessions };
      });
      const [roomClose] = await Promise.all([
        closeRooms(deps.rooms, sessions),
        deps.deletion.deleteForStudent(studentId, at),
      ]);
      if (!roomClose.ok) throw roomClose.error;
      return withdrawn;
    },
  };
}

async function closeRooms(
  rooms: VoiceRoomCloser,
  sessions: Awaited<ReturnType<VoiceSessionRepository['closeForStudent']>>,
): Promise<Readonly<{ ok: true }> | Readonly<{ ok: false; error: unknown }>> {
  const results = await Promise.allSettled(
    sessions.map((session) =>
      rooms.close(voiceRoomName(session.sessionId, session.connectionEpoch)),
    ),
  );
  const rejected = results.find((result) => result.status === 'rejected');
  if (rejected === undefined) return { ok: true };
  const error: unknown = rejected.reason;
  return { ok: false, error };
}
