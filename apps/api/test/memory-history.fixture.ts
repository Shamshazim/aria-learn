import type { NewLearnerBrief, NewLearnerEpisode } from '@/types/memory-history';

import type { TestDatabase } from './db.harness';

/** Shared rows for the P3-01 repository tests: one family, one session, one skill. */

export const NOW = new Date('2026-10-12T18:00:00.000Z');
export const PARENT_ID = '00000000-0000-4000-8000-000000000701';
export const STUDENT_ID = '00000000-0000-4000-8000-000000000702';
export const OTHER_STUDENT_ID = '00000000-0000-4000-8000-000000000703';
export const SESSION_ID = '00000000-0000-4000-8000-000000000704';
export const SKILL_CODE = 'p3.fixture';

export function evidenceId(n: number): string {
  return `00000000-0000-4000-8000-${String(800 + n).padStart(12, '0')}`;
}

export async function seedFamily(database: TestDatabase): Promise<void> {
  const q = (sql: string, params: unknown[]): Promise<unknown> => database.pool.query(sql, params);
  await q("INSERT INTO parent (id, display_name) VALUES ($1, 'Parent')", [PARENT_ID]);
  // Siblings: one family may not have two children with the same name.
  for (const [id, name] of [
    [STUDENT_ID, 'Child'],
    [OTHER_STUDENT_ID, 'Sibling'],
  ]) {
    await q(
      "INSERT INTO student (id, parent_id, display_name, grade, band) VALUES ($1, $2, $3, '2', 'early')",
      [id, PARENT_ID, name],
    );
  }
  await q(
    "INSERT INTO session (id, student_id, subject, grade, band) VALUES ($1, $2, 'arithmetic', '2', 'early')",
    [SESSION_ID, STUDENT_ID],
  );
  await q(
    "INSERT INTO skill (code, subject, strand, name, band) VALUES ($1, 'arithmetic', 'fixture', 'Fixture skill', 'early')",
    [SKILL_CODE],
  );
}

export function episode(overrides: Partial<NewLearnerEpisode> = {}): NewLearnerEpisode {
  return {
    studentId: STUDENT_ID,
    at: NOW,
    kind: 'breakthrough',
    summary: 'Carried the ten without counting on fingers for the first time.',
    importance: 0.8,
    skillCode: SKILL_CODE,
    sourceSessionId: SESSION_ID,
    sensitivity: 'normal',
    modelShareable: true,
    expiresAt: null,
    evidence: [{ sourceKind: 'session_event', sourceId: evidenceId(1) }],
    ...overrides,
  };
}

export function brief(overrides: Partial<NewLearnerBrief> = {}): NewLearnerBrief {
  return {
    studentId: STUDENT_ID,
    period: 'week',
    periodStart: '2026-10-05',
    writtenAt: NOW,
    body: 'This week she practised adding with regrouping and asked for harder ones.',
    evidenceSnapshot: { factIds: [], episodeIds: [], skillCodes: [SKILL_CODE] },
    generator: 'brief.weekly@1 / test-model',
    ...overrides,
  };
}
