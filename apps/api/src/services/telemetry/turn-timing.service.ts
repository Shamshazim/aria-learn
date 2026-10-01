import type { Band, TurnTimingReport, TurnTimingResponse } from '@aria/shared';

import { ForbiddenError, NotFoundError } from '@/errors';
import type { ClientTimingObserver } from '@/observability/client-metrics';
import type { TutorSessionRecord } from '@/types/session';

/**
 * What the browser measured, turned into the two §11 bars nothing else can see (X-04 part 2).
 *
 * The service does three things and nothing else: it proves the report belongs to the child
 * who sent it, it works out the band to label the histograms with, and it hands each
 * measurement to the observer. It holds no state, writes no rows, and never touches `res` —
 * the numbers live in the metrics store the scrape endpoint reads (CODE-STANDARDS §3.1).
 *
 * Nothing here is persisted. A client timing is evidence about the system, not about the
 * child: it answers "is a bar being met" for as long as a Prometheus retention window, and a
 * `client_timing` table would be a growing pile of rows about children that no product
 * feature reads (`master-plan.md` §12).
 */
export type TurnTimingService = Readonly<{
  record(studentId: string, report: TurnTimingReport): Promise<TurnTimingResponse>;
}>;

/** The two reads this needs, named as ports so a test fakes them rather than a database. */
type Sessions = Readonly<{ findById(id: string): Promise<TutorSessionRecord | null> }>;
type Students = Readonly<{
  requireById(id: string): Promise<Readonly<{ band: Band; isSynthetic: boolean }>>;
}>;

export function createTurnTimingService(deps: {
  sessions: Sessions;
  students: Students;
  observe: ClientTimingObserver;
}): TurnTimingService {
  return {
    record: async (studentId, report) => {
      const student = await deps.students.requireById(studentId);
      const band = await bandFor(deps, studentId, report.sessionId, student.band);
      let recorded = 0;
      for (const timing of report.timings) {
        const outcome = deps.observe({ ...timing, band, isSynthetic: student.isSynthetic });
        if (outcome === 'recorded') recorded += 1;
      }
      return { recorded, dropped: report.timings.length - recorded };
    },
  };
}

/**
 * The band to label the histograms with, and the ownership check on the way to it.
 *
 * The session's band rather than the child's wherever there is a session, because the two can
 * differ: a development grade override starts a session in another band, and the latency a
 * histogram is recording belongs to the session that produced it.
 *
 * Checking ownership is the same check the turn route makes, and for the same reason: a
 * session id is the only identifier in the payload, so without it any signed-in child could
 * file measurements against a stranger's session. What that would buy is small — the band
 * label on a histogram — but "small" is not a reason to let one child write against another's.
 *
 * A session that has already ended is accepted. The last interrupt of a session is measured
 * while Aria is still talking and reported a moment later, often after the child has left the
 * page; refusing an ended session would systematically lose the final turn of every session,
 * which is the turn most likely to be the slow one.
 */
async function bandFor(
  deps: Readonly<{ sessions: Sessions }>,
  studentId: string,
  sessionId: string | undefined,
  studentBand: Band,
): Promise<Band> {
  if (sessionId === undefined) return studentBand;
  const session = await deps.sessions.findById(sessionId);
  if (session === null) throw new NotFoundError('session not found');
  if (session.studentId !== studentId) {
    throw new ForbiddenError('student session ownership mismatch');
  }
  return session.band;
}
