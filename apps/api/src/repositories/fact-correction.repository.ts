import { runQuery } from '@/db/run-query';
import type { Queryable } from '@/db/types';
import { NotFoundError, ValidationError } from '@/errors';
import type { IdGenerator } from '@/lib/ids';
import { CORRECTION_COLUMNS, toCorrection } from '@/mappers/memory.mappers';
import type { CorrectionRow } from '@/mappers/memory.mappers';
import type { CorrectionRecord, NewFactCorrection } from '@/types/memory-history';

/**
 * Correction history (P3-01; P3-06 writes it). Append-only: a correction is never edited or
 * removed except by the `student` cascade.
 *
 * The target may already be superseded — correcting history is allowed and audited — but a
 * replacement must be a *current* row of the same kind for the same child, or the correction
 * would point readers at something that is itself already out of date.
 */
export type FactCorrectionRepository = Readonly<{
  withDb(db: Queryable): FactCorrectionRepository;
  insert(input: NewFactCorrection): Promise<CorrectionRecord>;
  /** Newest first. */
  listForStudent(studentId: string): Promise<readonly CorrectionRecord[]>;
}>;

type Deps = { db: Queryable; ids: IdGenerator };

export function createFactCorrectionRepository(deps: Deps): FactCorrectionRepository {
  return {
    withDb: (db) => createFactCorrectionRepository({ ...deps, db }),
    insert: (input) => insert(deps, input),
    listForStudent: (studentId) => listForStudent(deps.db, studentId),
  };
}

async function insert(deps: Deps, input: NewFactCorrection): Promise<CorrectionRecord> {
  if ((input.replacementId === null) !== (input.newValue === null))
    throw new ValidationError('a correction has both a replacement and a new value, or neither');
  await checkReferences(deps.db, input);
  const result = await runQuery<CorrectionRow>({
    db: deps.db,
    operation: 'factCorrection.insert',
    sql: `INSERT INTO learner_fact_correction
            (id, student_id, target_kind, target_id, replacement_id, corrected_by,
             corrected_by_id, old_value, new_value, reason, at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11)
          RETURNING ${CORRECTION_COLUMNS}`,
    params: [
      deps.ids.next(),
      input.studentId,
      input.targetKind,
      input.targetId,
      input.replacementId,
      input.correctedBy,
      input.correctedById,
      JSON.stringify(input.oldValue),
      input.newValue === null ? null : JSON.stringify(input.newValue),
      input.reason,
      input.at,
    ],
  });
  const row = result.rows[0];
  if (row === undefined) throw new Error('factCorrection.insert returned no row');
  return toCorrection(row);
}

/** The target and replacement live in either `learner_fact` or `learner_episode`. */
async function checkReferences(db: Queryable, input: NewFactCorrection): Promise<void> {
  const result = await runQuery<{ target_found: boolean; replacement_current: boolean }>({
    db,
    operation: 'factCorrection.checkReferences',
    sql: `SELECT
            EXISTS (
              SELECT 1 FROM learner_fact WHERE $4 = 'fact' AND id = $1 AND student_id = $3
              UNION ALL
              SELECT 1 FROM learner_episode WHERE $4 = 'episode' AND id = $1 AND student_id = $3
            ) AS target_found,
            ($2::uuid IS NULL OR EXISTS (
              SELECT 1 FROM learner_fact
              WHERE $4 = 'fact' AND id = $2::uuid AND student_id = $3 AND superseded_by IS NULL
              UNION ALL
              SELECT 1 FROM learner_episode
              WHERE $4 = 'episode' AND id = $2::uuid AND student_id = $3 AND superseded_by IS NULL
            )) AS replacement_current`,
    params: [input.targetId, input.replacementId, input.studentId, input.targetKind],
  });
  const check = result.rows[0];
  if (check?.target_found !== true)
    throw new NotFoundError(`correction target ${input.targetKind} not found for this student`);
  if (!check.replacement_current)
    throw new ValidationError(`correction replacement is not a current ${input.targetKind}`);
}

async function listForStudent(
  db: Queryable,
  studentId: string,
): Promise<readonly CorrectionRecord[]> {
  const result = await runQuery<CorrectionRow>({
    db,
    operation: 'factCorrection.listForStudent',
    sql: `SELECT ${CORRECTION_COLUMNS} FROM learner_fact_correction
          WHERE student_id = $1 ORDER BY at DESC, id`,
    params: [studentId],
  });
  return result.rows.map(toCorrection);
}
