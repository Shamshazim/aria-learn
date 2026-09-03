import { tutorMoveSchema, type TutorMove } from '@aria/shared';

import type { SessionEventRepository } from '@/repositories/session-event.repository';
import type { TutorSessionRecord } from '@/types/session';

export type ResumedSession = Readonly<{
  session: TutorSessionRecord;
  moves: readonly TutorMove[];
  lastAppliedSeq: number;
  /** When anybody last did anything in it, so a resume can tell a lesson from a leftover. */
  lastActivityAt: Date;
}>;

export type ResumeService = Readonly<{
  rebuild(session: TutorSessionRecord): Promise<ResumedSession>;
}>;

export function createResumeService(events: SessionEventRepository): ResumeService {
  return {
    rebuild: async (session: TutorSessionRecord): Promise<ResumedSession> => {
      const records = await events.list(session.id);
      // Aria's spoken sentences ("Aria talks") are recorded beside her moves; only the moves
      // are replayed, and a record that is not one must not cost the child the session.
      const moves = records
        .filter((record) => record.actor === 'aria')
        .flatMap((record) => {
          const parsed = tutorMoveSchema.safeParse(record.payload);
          return parsed.success ? [parsed.data] : [];
        });
      return {
        session,
        moves,
        lastAppliedSeq: records.at(-1)?.seq ?? 0,
        lastActivityAt: records.at(-1)?.at ?? session.startedAt,
      };
    },
  };
}
