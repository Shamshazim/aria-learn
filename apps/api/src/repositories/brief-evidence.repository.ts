import { runQuery } from '@/db/run-query';
import type { Queryable } from '@/db/types';

/** The one read the learner brief needs that no other repository has (P3-03). */
export type BriefEvidenceRepository = Readonly<{
  /** Sessions the child started in `[from, to)`. */
  countSessions(studentId: string, from: Date, to: Date): Promise<number>;
}>;

export function createBriefEvidenceRepository(db: Queryable): BriefEvidenceRepository {
  return {
    countSessions: async (studentId, from, to) => {
      const result = await runQuery<{ count: number }>({
        db,
        operation: 'brief.countSessions',
        sql: `SELECT COUNT(*)::int AS count FROM session
              WHERE student_id = $1 AND started_at >= $2 AND started_at < $3`,
        params: [studentId, from, to],
      });
      return result.rows[0]?.count ?? 0;
    },
  };
}
