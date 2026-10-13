import type { BriefPeriod } from '@aria/shared';

import { runQuery } from '@/db/run-query';
import type { Queryable } from '@/db/types';
import { ConflictError, ValidationError } from '@/errors';
import type { IdGenerator } from '@/lib/ids';
import { BRIEF_COLUMNS, toBrief } from '@/mappers/memory.mappers';
import type { BriefRow } from '@/mappers/memory.mappers';
import type { BriefRecord, NewLearnerBrief } from '@/types/memory-history';

/**
 * Versioned learner briefs (P3-01; P3-03 writes them).
 *
 * `insertVersion` both writes version `max + 1` and retires the version that was current, in
 * one statement — so there is never a moment with two current briefs for one period. "Current"
 * means `superseded_by IS NULL`, not the highest number: a gap in the versions is allowed.
 */
export type LearnerBriefRepository = Readonly<{
  withDb(db: Queryable): LearnerBriefRepository;
  insertVersion(input: NewLearnerBrief): Promise<BriefRecord>;
  current(studentId: string, period: BriefPeriod, periodStart: string): Promise<BriefRecord | null>;
  /** Every version of every brief for the period kind, newest period and version first. */
  history(studentId: string, period: BriefPeriod): Promise<readonly BriefRecord[]>;
}>;

type Deps = { db: Queryable; ids: IdGenerator };

/** A concurrent writer took our version number: recompute once, then give up loudly. */
const ATTEMPTS = 2;
const GENERATOR_MAX = 64;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function createLearnerBriefRepository(deps: Deps): LearnerBriefRepository {
  return {
    withDb: (db) => createLearnerBriefRepository({ ...deps, db }),
    insertVersion: (input) => insertVersion(deps, input),
    current: (studentId, period, start) => current(deps.db, studentId, period, start),
    history: (studentId, period) => history(deps.db, studentId, period),
  };
}

async function insertVersion(deps: Deps, input: NewLearnerBrief): Promise<BriefRecord> {
  validate(input);
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    const written = await tryInsert(deps, input);
    if (written !== null) return written;
  }
  throw new ConflictError('learner brief version collided twice with a concurrent writer');
}

/**
 * `ON CONFLICT DO NOTHING` rather than catching the unique violation: an error would abort the
 * caller's transaction, and a retry inside an aborted transaction can never succeed. A row
 * that lost the race simply comes back empty, and the next attempt sees the winner's version.
 */
async function tryInsert(deps: Deps, input: NewLearnerBrief): Promise<BriefRecord | null> {
  const result = await runQuery<BriefRow>({
    db: deps.db,
    operation: 'learnerBrief.insertVersion',
    sql: `WITH next AS (
            SELECT COALESCE(MAX(version), 0) + 1 AS version FROM learner_brief
            WHERE student_id = $2 AND period = $3 AND period_start = $4::date
          ), brief AS (
            INSERT INTO learner_brief
              (id, student_id, period, period_start, version, written_at, body,
               evidence_snapshot, generator)
            SELECT $1, $2, $3, $4::date, next.version, $5, $6, $7::jsonb, $8 FROM next
            ON CONFLICT (student_id, period, period_start, version) DO NOTHING
            RETURNING ${BRIEF_COLUMNS}
          ), retired AS (
            UPDATE learner_brief SET superseded_by = (SELECT id FROM brief)
            WHERE student_id = $2 AND period = $3 AND period_start = $4::date
              AND superseded_by IS NULL AND EXISTS (SELECT 1 FROM brief)
            RETURNING id
          )
          SELECT brief.* FROM brief`,
    params: [
      deps.ids.next(),
      input.studentId,
      input.period,
      input.periodStart,
      input.writtenAt,
      input.body,
      JSON.stringify(input.evidenceSnapshot),
      input.generator,
    ],
  });
  const row = result.rows[0];
  return row === undefined ? null : toBrief(row);
}

async function current(
  db: Queryable,
  studentId: string,
  period: BriefPeriod,
  periodStart: string,
): Promise<BriefRecord | null> {
  const result = await runQuery<BriefRow>({
    db,
    operation: 'learnerBrief.current',
    sql: `SELECT ${BRIEF_COLUMNS} FROM learner_brief
          WHERE student_id = $1 AND period = $2 AND period_start = $3::date
            AND superseded_by IS NULL
          ORDER BY version DESC LIMIT 1`,
    params: [studentId, period, periodStart],
  });
  const row = result.rows[0];
  return row === undefined ? null : toBrief(row);
}

async function history(
  db: Queryable,
  studentId: string,
  period: BriefPeriod,
): Promise<readonly BriefRecord[]> {
  const result = await runQuery<BriefRow>({
    db,
    operation: 'learnerBrief.history',
    sql: `SELECT ${BRIEF_COLUMNS} FROM learner_brief
          WHERE student_id = $1 AND period = $2
          ORDER BY period_start DESC, version DESC`,
    params: [studentId, period],
  });
  return result.rows.map(toBrief);
}

function validate(input: NewLearnerBrief): void {
  if (!ISO_DATE.test(input.periodStart) || Number.isNaN(Date.parse(input.periodStart)))
    throw new ValidationError('learner brief periodStart must be a YYYY-MM-DD date');
  if (input.body.trim() === '') throw new ValidationError('learner brief body is empty');
  if (input.generator.trim() === '' || input.generator.length > GENERATOR_MAX)
    throw new ValidationError(
      `learner brief generator must be 1..${String(GENERATOR_MAX)} characters`,
    );
}
