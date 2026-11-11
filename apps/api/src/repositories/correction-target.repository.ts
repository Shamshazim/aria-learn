import { z } from 'zod';

import type { EpisodeEvidence } from '@aria/shared';

import { runQuery } from '@/db/run-query';
import type { Queryable } from '@/db/types';
import { ConflictError } from '@/errors';
import { EPISODE_COLUMNS, toEpisode, type EpisodeRow } from '@/mappers/memory.mappers';
import type { EpisodeRecord } from '@/types/memory-history';

/**
 * What a correction needs from the memory it corrects (P3-06): the row, locked for the rest
 * of the transaction so two corrections to one fact take turns; whether it is still current;
 * and, when it is not, which row is. Split from the fact and episode repositories, which
 * stay about writing memory rather than about rewriting it.
 */
export type CorrectionFact = Readonly<{
  id: string;
  kind: string;
  value: Readonly<Record<string, unknown>>;
  sensitivity: string;
  modelShareable: boolean;
  firstObservedAt: Date;
}>;

export type LockedTarget<T> = Readonly<{ row: T; current: boolean }>;

export type CorrectionTargetRepository = Readonly<{
  withDb(db: Queryable): CorrectionTargetRepository;
  lockFact(studentId: string, id: string, now: Date): Promise<LockedTarget<CorrectionFact> | null>;
  lockEpisode(
    studentId: string,
    id: string,
    now: Date,
  ): Promise<LockedTarget<EpisodeRecord> | null>;
  episodeEvidence(episodeId: string): Promise<readonly EpisodeEvidence[]>;
  /** The row that replaced this one, followed to the end; `null` when that was retracted. */
  currentOf(targetKind: 'fact' | 'episode', id: string, now: Date): Promise<string | null>;
  supersedeFact(previousId: string, replacementId: string): Promise<void>;
  expire(targetKind: 'fact' | 'episode', id: string, at: Date): Promise<void>;
}>;

const factSchema = z.object({
  id: z.string(),
  kind: z.string(),
  value: z.record(z.string(), z.unknown()),
  sensitivity: z.string(),
  model_shareable: z.boolean(),
  first_observed_at: z.date(),
  current: z.boolean(),
});

/** Table names come from this map, never from input. */
const TABLE = { fact: 'learner_fact', episode: 'learner_episode' } as const;

export function createCorrectionTargetRepository(db: Queryable): CorrectionTargetRepository {
  return {
    withDb: (next) => createCorrectionTargetRepository(next),
    lockFact: (studentId, id, now) => lockFact(db, studentId, id, now),
    lockEpisode: (studentId, id, now) => lockEpisode(db, studentId, id, now),
    episodeEvidence: (episodeId) => episodeEvidence(db, episodeId),
    currentOf: (targetKind, id, now) => currentOf(db, targetKind, id, now),
    supersedeFact: (previousId, replacementId) => supersedeFact(db, previousId, replacementId),
    expire: (targetKind, id, at) => expire(db, targetKind, id, at),
  };
}

async function lockFact(
  db: Queryable,
  studentId: string,
  id: string,
  now: Date,
): Promise<LockedTarget<CorrectionFact> | null> {
  const result = await runQuery<z.infer<typeof factSchema>>({
    db,
    operation: 'correctionTarget.lockFact',
    sql: `SELECT id, kind, value, sensitivity, model_shareable, first_observed_at,
            (superseded_by IS NULL AND (expires_at IS NULL OR expires_at > $3)) AS current
          FROM learner_fact WHERE id = $1 AND student_id = $2 FOR UPDATE`,
    params: [id, studentId, now],
  });
  const row = result.rows[0] === undefined ? null : factSchema.parse(result.rows[0]);
  if (row === null) return null;
  return {
    current: row.current,
    row: {
      id: row.id,
      kind: row.kind,
      value: row.value,
      sensitivity: row.sensitivity,
      modelShareable: row.model_shareable,
      firstObservedAt: row.first_observed_at,
    },
  };
}

async function lockEpisode(
  db: Queryable,
  studentId: string,
  id: string,
  now: Date,
): Promise<LockedTarget<EpisodeRecord> | null> {
  const result = await runQuery<EpisodeRow & { current: boolean }>({
    db,
    operation: 'correctionTarget.lockEpisode',
    sql: `SELECT ${EPISODE_COLUMNS},
            (superseded_by IS NULL AND (expires_at IS NULL OR expires_at > $3)) AS current
          FROM learner_episode WHERE id = $1 AND student_id = $2 FOR UPDATE`,
    params: [id, studentId, now],
  });
  const row = result.rows[0];
  return row === undefined ? null : { row: toEpisode(row), current: row.current };
}

async function episodeEvidence(
  db: Queryable,
  episodeId: string,
): Promise<readonly EpisodeEvidence[]> {
  const result = await runQuery<{ source_kind: EpisodeEvidence['sourceKind']; source_id: string }>({
    db,
    operation: 'correctionTarget.episodeEvidence',
    sql: `SELECT source_kind, source_id FROM learner_episode_evidence
          WHERE episode_id = $1 ORDER BY recorded_at, source_id`,
    params: [episodeId],
  });
  return result.rows.map((row) => ({ sourceKind: row.source_kind, sourceId: row.source_id }));
}

async function currentOf(
  db: Queryable,
  targetKind: 'fact' | 'episode',
  id: string,
  now: Date,
): Promise<string | null> {
  const table = TABLE[targetKind];
  const result = await runQuery<{ id: string; live: boolean }>({
    db,
    operation: `correctionTarget.currentOf.${targetKind}`,
    sql: `WITH RECURSIVE chain(id, superseded_by, expires_at, depth) AS (
            SELECT id, superseded_by, expires_at, 0 FROM ${table} WHERE id = $1
            UNION ALL
            SELECT t.id, t.superseded_by, t.expires_at, c.depth + 1
            FROM chain c JOIN ${table} t ON t.id = c.superseded_by
          )
          SELECT id, (expires_at IS NULL OR expires_at > $2) AS live
          FROM chain WHERE superseded_by IS NULL ORDER BY depth DESC LIMIT 1`,
    params: [id, now],
  });
  const row = result.rows[0];
  return row === undefined || !row.live || row.id === id ? null : row.id;
}

async function supersedeFact(
  db: Queryable,
  previousId: string,
  replacementId: string,
): Promise<void> {
  const result = await runQuery({
    db,
    operation: 'correctionTarget.supersedeFact',
    sql: 'UPDATE learner_fact SET superseded_by = $2 WHERE id = $1 AND superseded_by IS NULL',
    params: [previousId, replacementId],
  });
  if ((result.rowCount ?? 0) === 0) throw new ConflictError('fact was superseded concurrently');
}

/** A retraction: the row stays for the audit and drops out of every current read. */
async function expire(
  db: Queryable,
  targetKind: 'fact' | 'episode',
  id: string,
  at: Date,
): Promise<void> {
  await runQuery({
    db,
    operation: `correctionTarget.expire.${targetKind}`,
    sql: `UPDATE ${TABLE[targetKind]} SET expires_at = $2 WHERE id = $1`,
    params: [id, at],
  });
}
