import { tutorMoveSchema, type TutorMove } from '@aria/shared';

import type { SessionEventRepository } from '@/repositories/session-event.repository';
import type { TutorSessionRecord } from '@/types/session';

export type ResumedSession = Readonly<{
  session: TutorSessionRecord;
  moves: readonly TutorMove[];
  lastAppliedSeq: number;
}>;

export type ResumeService = Readonly<{
  rebuild(session: TutorSessionRecord): Promise<ResumedSession>;
}>;

export function createResumeService(events: SessionEventRepository): ResumeService {
  return {
    rebuild: async (session: TutorSessionRecord): Promise<ResumedSession> => {
      const records = await events.list(session.id);
      const moves = records
        .filter((record) => record.actor === 'aria')
        .map((record) => tutorMoveSchema.parse(record.payload));
      return { session, moves, lastAppliedSeq: records.at(-1)?.seq ?? 0 };
    },
  };
}
