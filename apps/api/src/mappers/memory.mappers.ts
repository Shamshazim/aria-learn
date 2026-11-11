import { z } from 'zod';

import { BRIEF_PERIODS, CORRECTED_BY, CORRECTION_TARGETS, EPISODE_KINDS } from '@aria/shared';
import type { CorrectionAuthor } from '@aria/shared';

import { unmappableRow } from '@/mappers/row';
import type { BriefRecord, CorrectionRecord, EpisodeRecord } from '@/types/memory-history';

/**
 * Row -> domain for the P3-01 memory-history tables. A row outside its domain type is our bug
 * and maps to a 500 naming the column, never the value (see `row.ts`).
 */

export type EpisodeRow = {
  id: string;
  student_id: string;
  at: Date;
  kind: string;
  summary: string;
  importance: string | number;
  skill_code: string | null;
  source_session_id: string;
  sensitivity: string;
  model_shareable: boolean;
  expires_at: Date | null;
  superseded_by: string | null;
};

export type BriefRow = {
  id: string;
  student_id: string;
  period: string;
  /** Selected as `period_start::text` so no time zone can move the day. */
  period_start: string;
  version: number;
  written_at: Date;
  body: string;
  evidence_snapshot: unknown;
  generator: string;
  superseded_by: string | null;
};

export type CorrectionRow = {
  id: string;
  student_id: string;
  target_kind: string;
  target_id: string;
  replacement_id: string | null;
  corrected_by: string;
  corrected_by_id: string | null;
  old_value: unknown;
  new_value: unknown;
  reason: string | null;
  at: Date;
};

export const EPISODE_COLUMNS = `id, student_id, at, kind, summary, importance, skill_code,
  source_session_id, sensitivity, model_shareable, expires_at, superseded_by`;
export const BRIEF_COLUMNS = `id, student_id, period, period_start::text AS period_start, version,
  written_at, body, evidence_snapshot, generator, superseded_by`;
export const CORRECTION_COLUMNS = `id, student_id, target_kind, target_id, replacement_id,
  corrected_by, corrected_by_id, old_value, new_value, reason, at`;

const episodeKind = z.enum(EPISODE_KINDS);
const briefPeriod = z.enum(BRIEF_PERIODS);
const correctionTarget = z.enum(CORRECTION_TARGETS);
const correctedBy = z.enum(CORRECTED_BY);
const importance = z.coerce.number().min(0).max(1);
const snapshot = z.object({
  factIds: z.array(z.string()),
  episodeIds: z.array(z.string()),
  skillCodes: z.array(z.string()),
});
const record = z.record(z.string(), z.unknown());

export function toEpisode(row: EpisodeRow): EpisodeRecord {
  const kind = episodeKind.safeParse(row.kind);
  if (!kind.success) throw unmappableRow('learner_episode', 'kind', row.id);
  const weight = importance.safeParse(row.importance);
  if (!weight.success) throw unmappableRow('learner_episode', 'importance', row.id);
  return {
    id: row.id,
    studentId: row.student_id,
    at: row.at,
    kind: kind.data,
    summary: row.summary,
    importance: weight.data,
    skillCode: row.skill_code,
    sourceSessionId: row.source_session_id,
    sensitivity: row.sensitivity,
    modelShareable: row.model_shareable,
    expiresAt: row.expires_at,
    supersededBy: row.superseded_by,
  };
}

export function toBrief(row: BriefRow): BriefRecord {
  const period = briefPeriod.safeParse(row.period);
  if (!period.success) throw unmappableRow('learner_brief', 'period', row.id);
  const evidence = snapshot.safeParse(row.evidence_snapshot);
  if (!evidence.success) throw unmappableRow('learner_brief', 'evidence_snapshot', row.id);
  return {
    id: row.id,
    studentId: row.student_id,
    period: period.data,
    periodStart: row.period_start,
    version: row.version,
    writtenAt: row.written_at,
    body: row.body,
    evidenceSnapshot: evidence.data,
    generator: row.generator,
    supersededBy: row.superseded_by,
  };
}

export function toCorrection(row: CorrectionRow): CorrectionRecord {
  const target = correctionTarget.safeParse(row.target_kind);
  if (!target.success) throw unmappableRow('learner_fact_correction', 'target_kind', row.id);
  const oldValue = record.safeParse(row.old_value);
  if (!oldValue.success) throw unmappableRow('learner_fact_correction', 'old_value', row.id);
  const newValue = row.new_value === null ? null : record.safeParse(row.new_value);
  if (newValue !== null && !newValue.success)
    throw unmappableRow('learner_fact_correction', 'new_value', row.id);
  return {
    ...toAuthor(row),
    id: row.id,
    studentId: row.student_id,
    targetKind: target.data,
    targetId: row.target_id,
    replacementId: row.replacement_id,
    oldValue: oldValue.data,
    newValue: newValue === null ? null : newValue.data,
    reason: row.reason,
    at: row.at,
  };
}

function toAuthor(row: CorrectionRow): CorrectionAuthor {
  const author = correctedBy.safeParse(row.corrected_by);
  if (!author.success) throw unmappableRow('learner_fact_correction', 'corrected_by', row.id);
  const id = row.corrected_by_id;
  switch (author.data) {
    case 'parent':
      if (id === null) throw unmappableRow('learner_fact_correction', 'corrected_by_id', row.id);
      return { correctedBy: 'parent', correctedById: id };
    case 'child':
      if (id !== null) throw unmappableRow('learner_fact_correction', 'corrected_by_id', row.id);
      return { correctedBy: 'child', correctedById: null };
    case 'staff':
      return { correctedBy: 'staff', correctedById: id };
  }
}
