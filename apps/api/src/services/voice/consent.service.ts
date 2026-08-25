import { ForbiddenError, NotFoundError } from '@/errors';
import type { Clock } from '@/lib/clock';
import type { IdGenerator } from '@/lib/ids';
import type { StudentRepository } from '@/repositories/student.repository';
import type { VoiceConsentRepository } from '@/repositories/voice-consent.repository';
import type { VoiceSessionRepository } from '@/repositories/voice-session.repository';
import type { AudioDeletionService } from '@/services/voice/audio-deletion.service';
import type { VoiceConsent } from '@/types/voice';

export type VoiceRoomCloser = Readonly<{ close(sessionId: string): Promise<void> }>;

export function createVoiceConsentService(deps: {
  students: Pick<StudentRepository, 'findById'>;
  consent: Pick<VoiceConsentRepository, 'grant' | 'withdraw'>;
  sessions: Pick<VoiceSessionRepository, 'closeForStudent'>;
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
      const at = deps.clock.now();
      const withdrawn = await deps.consent.withdraw(studentId, at);
      const sessionIds = await deps.sessions.closeForStudent(studentId, at);
      await Promise.all([
        ...sessionIds.map((sessionId) => deps.rooms.close(sessionId)),
        deps.deletion.deleteForStudent(studentId, at),
      ]);
      return withdrawn;
    },
  };
}
