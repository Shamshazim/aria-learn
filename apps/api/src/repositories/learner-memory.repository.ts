import { z } from 'zod';

import { runQuery } from '@/db/run-query';
import type { Queryable } from '@/db/types';
import { ValidationError } from '@/errors';
import type { IdGenerator } from '@/lib/ids';
import type { FactEvidence, LearnerFact, NewLearnerFact, Observation } from '@/types/memory';

const TEMPORARY_KINDS = new Set(['mood', 'engagement_state', 'temporary_preference']);
const REJECTED_KINDS = new Set(['iq', 'diagnosis', 'gifted', 'slow', 'intelligence']);

const factRowSchema = z.object({
  id: z.string(),
  student_id: z.string(),
  kind: z.string(),
  value: z.record(z.string(), z.unknown()),
  confidence: z.coerce.number(),
  first_observed_at: z.date(),
  last_confirmed_at: z.date(),
  expires_at: z.date().nullable(),
  sensitivity: z.string(),
  model_shareable: z.boolean(),
  superseded_by: z.string().nullable(),
});

type FactRow = z.infer<typeof factRowSchema>;

export type LearnerMemoryRepository = Readonly<{
  withDb(db: Queryable): LearnerMemoryRepository;
  insertFact(input: NewLearnerFact): Promise<LearnerFact>;
  listCurrent(studentId: string, at: Date): Promise<readonly LearnerFact[]>;
  supersede(previousId: string, replacement: NewLearnerFact): Promise<LearnerFact>;
  insertObservation(input: Omit<Observation, 'id'>): Promise<Observation>;
  hasEvidence(sourceKind: FactEvidence['sourceKind'], sourceId: string): Promise<boolean>;
  countObservations(studentId: string, kind: string): Promise<number>;
}>;

export function createLearnerMemoryRepository(deps: {
  db: Queryable;
  ids: IdGenerator;
}): LearnerMemoryRepository {
  return {
    withDb: (db) => createLearnerMemoryRepository({ ...deps, db }),
    insertFact: (input) => insertFact(deps, input),
    listCurrent: (studentId, at) => listCurrent(deps.db, studentId, at),
    supersede: (previousId, replacement) => supersede(deps, previousId, replacement),
    insertObservation: (input) => insertObservation(deps, input),
    hasEvidence: (kind, id) => hasEvidence(deps.db, kind, id),
    countObservations: (studentId, kind) => countObservations(deps.db, studentId, kind),
  };
}

async function countObservations(db: Queryable, studentId: string, kind: string): Promise<number> {
  const result = await runQuery<{ count: number }>({
    db,
    operation: 'observation.countByKind',
    sql: 'SELECT COUNT(*)::int AS count FROM observation WHERE student_id = $1 AND kind = $2',
    params: [studentId, kind],
  });
  return result.rows[0]?.count ?? 0;
}

async function hasEvidence(
  db: Queryable,
  sourceKind: FactEvidence['sourceKind'],
  sourceId: string,
): Promise<boolean> {
  const result = await runQuery<{ exists: boolean }>({
    db,
    operation: 'learnerFact.hasEvidence',
    sql: `SELECT EXISTS (
            SELECT 1 FROM learner_fact_evidence WHERE source_kind = $1 AND source_id = $2
            UNION ALL
            SELECT 1 FROM observation WHERE $1 = 'session_event' AND source_event_id = $2
          ) AS exists`,
    params: [sourceKind, sourceId],
  });
  return result.rows[0]?.exists ?? false;
}

async function insertFact(
  deps: Parameters<typeof createLearnerMemoryRepository>[0],
  input: NewLearnerFact,
): Promise<LearnerFact> {
  validateFact(input);
  const id = deps.ids.next();
  const result = await runQuery<FactRow>({
    db: deps.db,
    operation: 'learnerFact.insert',
    sql: `WITH fact AS (
            INSERT INTO learner_fact
            (id, student_id, kind, value, confidence, first_observed_at, last_confirmed_at,
             expires_at, sensitivity, model_shareable)
            VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10)
            RETURNING id, student_id, kind, value, confidence, first_observed_at,
              last_confirmed_at, expires_at, sensitivity, model_shareable, superseded_by
          ), evidence AS (
            INSERT INTO learner_fact_evidence (fact_id, source_kind, source_id)
            SELECT fact.id, item.source_kind, item.source_id::uuid
            FROM fact, jsonb_to_recordset($11::jsonb)
              AS item(source_kind text, source_id text)
            RETURNING fact_id
          )
          SELECT fact.* FROM fact WHERE EXISTS (SELECT 1 FROM evidence)`,
    params: [
      id,
      input.studentId,
      input.kind,
      JSON.stringify(input.value),
      input.confidence,
      input.firstObservedAt,
      input.lastConfirmedAt,
      input.expiresAt,
      input.sensitivity,
      input.modelShareable,
      JSON.stringify(
        input.evidence.map((item) => ({
          source_kind: item.sourceKind,
          source_id: item.sourceId,
        })),
      ),
    ],
  });
  const row = result.rows[0];
  if (row === undefined) throw new Error('learnerFact.insert returned no row');
  return mapFact(row);
}

async function listCurrent(
  db: Queryable,
  studentId: string,
  at: Date,
): Promise<readonly LearnerFact[]> {
  const result = await runQuery<FactRow>({
    db,
    operation: 'learnerFact.listCurrent',
    sql: `SELECT id, student_id, kind, value, confidence, first_observed_at,
            last_confirmed_at, expires_at, sensitivity, model_shareable, superseded_by
          FROM learner_fact WHERE student_id = $1 AND superseded_by IS NULL
            AND (expires_at IS NULL OR expires_at > $2)
          ORDER BY confidence DESC, last_confirmed_at DESC, id`,
    params: [studentId, at],
  });
  return result.rows.map(mapFact);
}

async function supersede(
  deps: Parameters<typeof createLearnerMemoryRepository>[0],
  previousId: string,
  replacement: NewLearnerFact,
): Promise<LearnerFact> {
  const next = await insertFact(deps, replacement);
  await runQuery({
    db: deps.db,
    operation: 'learnerFact.supersede',
    sql: 'UPDATE learner_fact SET superseded_by = $2 WHERE id = $1 AND superseded_by IS NULL',
    params: [previousId, next.id],
  });
  return next;
}

async function insertObservation(
  deps: Parameters<typeof createLearnerMemoryRepository>[0],
  input: Omit<Observation, 'id'>,
): Promise<Observation> {
  const id = deps.ids.next();
  await runQuery({
    db: deps.db,
    operation: 'observation.insert',
    sql: `INSERT INTO observation
          (id, student_id, at, skill_code, kind, note, confidence, expires_at, source_event_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    params: [
      id,
      input.studentId,
      input.at,
      input.skillCode,
      input.kind,
      input.note,
      input.confidence,
      input.expiresAt,
      input.sourceEventId,
    ],
  });
  return { id, ...input };
}

function validateFact(input: NewLearnerFact): void {
  if (!Array.isArray(input.evidence) || input.evidence.length === 0)
    throw new ValidationError('learner facts require evidence');
  if (REJECTED_KINDS.has(input.kind))
    throw new ValidationError(`learner fact kind ${input.kind} is judgemental`);
  if (TEMPORARY_KINDS.has(input.kind) && input.expiresAt === null) {
    throw new ValidationError(`temporary learner fact kind ${input.kind} needs expiresAt`);
  }
}

function mapFact(input: FactRow): LearnerFact {
  const row = factRowSchema.parse(input);
  return {
    id: row.id,
    studentId: row.student_id,
    kind: row.kind,
    value: row.value,
    confidence: row.confidence,
    firstObservedAt: row.first_observed_at,
    lastConfirmedAt: row.last_confirmed_at,
    expiresAt: row.expires_at,
    sensitivity: row.sensitivity,
    modelShareable: row.model_shareable,
    supersededBy: row.superseded_by,
  };
}
