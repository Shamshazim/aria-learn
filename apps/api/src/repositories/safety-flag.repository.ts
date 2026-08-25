import { runQuery } from '@/db/run-query';
import type { Queryable } from '@/db/types';
import type { Clock } from '@/lib/clock';
import type { IdGenerator } from '@/lib/ids';
import type { CrisisCategory, EscalationRoute } from '@/safety/crisis/matrix';

export type SafetyFlag = Readonly<{
  id: string;
  studentId: string;
  sessionId: string;
  eventId: string | null;
  category: CrisisCategory;
  severity: string;
  text: string;
  detectedAt: Date;
  escalatedAt: Date | null;
  escalationRoute: EscalationRoute | null;
  needsReview: boolean;
}>;

export type SafetyFlagRepository = Readonly<{
  withDb(db: Queryable): SafetyFlagRepository;
  insert(input: Omit<SafetyFlag, 'id' | 'detectedAt'>): Promise<SafetyFlag>;
}>;

export function createSafetyFlagRepository(deps: {
  db: Queryable;
  ids: IdGenerator;
  clock: Clock;
}): SafetyFlagRepository {
  return {
    withDb: (db) => createSafetyFlagRepository({ ...deps, db }),
    insert: async (input) => {
      const record = { id: deps.ids.next(), detectedAt: deps.clock.now(), ...input };
      await runQuery({
        db: deps.db,
        operation: 'safetyFlag.insert',
        sql: `INSERT INTO safety_flag
          (id, student_id, session_id, event_id, category, severity, text, detected_at,
           escalated_at, escalation_route, needs_review)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        params: [
          record.id,
          record.studentId,
          record.sessionId,
          record.eventId,
          record.category,
          record.severity,
          record.text,
          record.detectedAt,
          record.escalatedAt,
          record.escalationRoute,
          record.needsReview,
        ],
      });
      return record;
    },
  };
}
