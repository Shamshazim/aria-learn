import { describe, expect, it } from 'vitest';

import { AppError } from '@/errors';

import { toBrief, toCorrection, toEpisode } from './memory.mappers';

import type { BriefRow, CorrectionRow, EpisodeRow } from './memory.mappers';

const AT = new Date('2026-10-12T18:00:00.000Z');

const episodeRow: EpisodeRow = {
  id: 'e1',
  student_id: 's1',
  at: AT,
  kind: 'breakthrough',
  summary: 'Read a whole page aloud.',
  importance: '0.75', // NUMERIC arrives as a string from pg
  skill_code: null,
  source_session_id: 'session-1',
  sensitivity: 'normal',
  model_shareable: true,
  expires_at: null,
  superseded_by: null,
};

const briefRow: BriefRow = {
  id: 'b1',
  student_id: 's1',
  period: 'week',
  period_start: '2026-10-05',
  version: 1,
  written_at: AT,
  body: 'A week of steady reading.',
  evidence_snapshot: { factIds: [], episodeIds: ['e1'], skillCodes: [] },
  generator: 'brief@1',
  superseded_by: null,
};

const correctionRow: CorrectionRow = {
  id: 'c1',
  student_id: 's1',
  target_kind: 'fact',
  target_id: 'f1',
  replacement_id: null,
  corrected_by: 'parent',
  corrected_by_id: 'p1',
  old_value: { text: 'likes dogs' },
  new_value: null,
  reason: null,
  at: AT,
};

describe('memory-history mappers', () => {
  it('maps valid rows, coercing NUMERIC importance', () => {
    expect(toEpisode(episodeRow).importance).toBe(0.75);
    expect(toBrief(briefRow).evidenceSnapshot.episodeIds).toEqual(['e1']);
    expect(toCorrection(correctionRow)).toMatchObject({
      correctedBy: 'parent',
      correctedById: 'p1',
    });
  });

  it.each([
    () => toEpisode({ ...episodeRow, kind: 'genius' }),
    () => toEpisode({ ...episodeRow, importance: '1.5' }),
    () => toBrief({ ...briefRow, period: 'decade' }),
    () => toBrief({ ...briefRow, evidence_snapshot: { factIds: 'f1' } }),
    () => toCorrection({ ...correctionRow, corrected_by_id: null }),
    () => toCorrection({ ...correctionRow, corrected_by: 'child' }),
    () => toCorrection({ ...correctionRow, old_value: ['not', 'a', 'record'] }),
  ])('refuses a row outside its domain type (#%#) as an internal error', (map) => {
    expect(map).toThrow(AppError);
  });
});
