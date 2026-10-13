import type { EpisodeEvidence, EpisodeEvidenceSource } from '@aria/shared';

import { runQuery } from '@/db/run-query';
import type { Queryable } from '@/db/types';
import { ConflictError, ValidationError } from '@/errors';
import type { IdGenerator } from '@/lib/ids';
import { EPISODE_COLUMNS, toEpisode } from '@/mappers/memory.mappers';
import type { EpisodeRow } from '@/mappers/memory.mappers';
import type { EpisodeRecord, NewLearnerEpisode } from '@/types/memory-history';

/**
 * Learner episodes (P3-01). Storage only: P3-02 decides what becomes an episode.
 *
 * `supersede` never deletes — a replaced episode stays for the audit trail and only the
 * `student` cascade (child erasure, P6-06) removes rows.
 */
export type LearnerEpisodeRepository = Readonly<{
  withDb(db: Queryable): LearnerEpisodeRepository;
  insert(input: NewLearnerEpisode): Promise<EpisodeRecord>;
  /** Current episodes: not superseded, not expired at `now`. Newest first. */
  listCurrent(studentId: string, now: Date): Promise<readonly EpisodeRecord[]>;
  supersede(previousId: string, replacement: NewLearnerEpisode): Promise<EpisodeRecord>;
  addEvidence(episodeId: string, evidence: readonly EpisodeEvidence[]): Promise<void>;
  hasEvidence(sourceKind: EpisodeEvidenceSource, sourceId: string): Promise<boolean>;
}>;

type Deps = { db: Queryable; ids: IdGenerator };

export function createLearnerEpisodeRepository(deps: Deps): LearnerEpisodeRepository {
  return {
    withDb: (db) => createLearnerEpisodeRepository({ ...deps, db }),
    insert: (input) => insert(deps, input),
    listCurrent: (studentId, now) => listCurrent(deps.db, studentId, now),
    supersede: (previousId, replacement) => supersede(deps, previousId, replacement),
    addEvidence: (episodeId, evidence) => addEvidence(deps.db, episodeId, evidence),
    hasEvidence: (sourceKind, sourceId) => hasEvidence(deps.db, sourceKind, sourceId),
  };
}

const INSERT_EPISODE = `INSERT INTO learner_episode
  (id, student_id, at, kind, summary, importance, skill_code, source_session_id, sensitivity,
   model_shareable, expires_at)`;

const INSERT_EVIDENCE = `INSERT INTO learner_episode_evidence (episode_id, source_kind, source_id)
  SELECT episode.id, item.source_kind, item.source_id::uuid
  FROM episode, jsonb_to_recordset($12::jsonb) AS item(source_kind text, source_id text)`;

async function insert(deps: Deps, input: NewLearnerEpisode): Promise<EpisodeRecord> {
  validate(input);
  const result = await runQuery<EpisodeRow>({
    db: deps.db,
    operation: 'learnerEpisode.insert',
    sql: `WITH episode AS (
            ${INSERT_EPISODE} VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING ${EPISODE_COLUMNS}
          ), evidence AS (${INSERT_EVIDENCE} RETURNING episode_id)
          SELECT episode.* FROM episode`,
    params: episodeParams(deps.ids.next(), input),
  });
  const row = result.rows[0];
  if (row === undefined) throw new Error('learnerEpisode.insert returned no row');
  return toEpisode(row);
}

/**
 * One statement, so a replacement and its predecessor's retirement cannot be split: the new
 * episode is only written if the old one is still current and belongs to the same child.
 */
async function supersede(
  deps: Deps,
  previousId: string,
  replacement: NewLearnerEpisode,
): Promise<EpisodeRecord> {
  validate(replacement);
  const result = await runQuery<EpisodeRow>({
    db: deps.db,
    operation: 'learnerEpisode.supersede',
    sql: `WITH previous AS (
            SELECT id FROM learner_episode
            WHERE id = $13 AND student_id = $2 AND superseded_by IS NULL FOR UPDATE
          ), episode AS (
            ${INSERT_EPISODE}
            SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11 WHERE EXISTS (SELECT 1 FROM previous)
            RETURNING ${EPISODE_COLUMNS}
          ), evidence AS (${INSERT_EVIDENCE} RETURNING episode_id),
          retired AS (
            UPDATE learner_episode SET superseded_by = (SELECT id FROM episode)
            WHERE id IN (SELECT id FROM previous) RETURNING id
          )
          SELECT episode.* FROM episode`,
    params: [...episodeParams(deps.ids.next(), replacement), previousId],
  });
  const row = result.rows[0];
  if (row === undefined) {
    throw new ConflictError(`learner episode ${previousId} is not current for this student`);
  }
  return toEpisode(row);
}

async function listCurrent(
  db: Queryable,
  studentId: string,
  now: Date,
): Promise<readonly EpisodeRecord[]> {
  const result = await runQuery<EpisodeRow>({
    db,
    operation: 'learnerEpisode.listCurrent',
    sql: `SELECT ${EPISODE_COLUMNS} FROM learner_episode
          WHERE student_id = $1 AND superseded_by IS NULL
            AND (expires_at IS NULL OR expires_at > $2)
          ORDER BY at DESC, id`,
    params: [studentId, now],
  });
  return result.rows.map(toEpisode);
}

async function addEvidence(
  db: Queryable,
  episodeId: string,
  evidence: readonly EpisodeEvidence[],
): Promise<void> {
  if (evidence.length === 0) return;
  await runQuery({
    db,
    operation: 'learnerEpisode.addEvidence',
    sql: `INSERT INTO learner_episode_evidence (episode_id, source_kind, source_id)
          SELECT $1, item.source_kind, item.source_id::uuid
          FROM jsonb_to_recordset($2::jsonb) AS item(source_kind text, source_id text)
          ON CONFLICT DO NOTHING`,
    params: [episodeId, evidenceJson(evidence)],
  });
}

async function hasEvidence(
  db: Queryable,
  sourceKind: EpisodeEvidenceSource,
  sourceId: string,
): Promise<boolean> {
  const result = await runQuery<{ exists: boolean }>({
    db,
    operation: 'learnerEpisode.hasEvidence',
    sql: `SELECT EXISTS (
            SELECT 1 FROM learner_episode_evidence WHERE source_kind = $1 AND source_id = $2
          ) AS exists`,
    params: [sourceKind, sourceId],
  });
  return result.rows[0]?.exists ?? false;
}

function episodeParams(id: string, input: NewLearnerEpisode): unknown[] {
  return [
    id,
    input.studentId,
    input.at,
    input.kind,
    input.summary,
    input.importance,
    input.skillCode,
    input.sourceSessionId,
    input.sensitivity,
    input.modelShareable,
    input.expiresAt,
    evidenceJson(input.evidence),
  ];
}

function evidenceJson(evidence: readonly EpisodeEvidence[]): string {
  return JSON.stringify(
    evidence.map((item) => ({ source_kind: item.sourceKind, source_id: item.sourceId })),
  );
}

function validate(input: NewLearnerEpisode): void {
  if (input.evidence.length === 0) throw new ValidationError('learner episodes require evidence');
  if (input.summary.trim() === '') throw new ValidationError('learner episode summary is empty');
  if (!(input.importance >= 0 && input.importance <= 1))
    throw new ValidationError('learner episode importance must be between 0 and 1');
}
