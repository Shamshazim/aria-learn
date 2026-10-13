import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MIGRATIONS_DIR } from '@/db/migration-files';
import { NotFoundError, ValidationError } from '@/errors';
import { sequentialUuids } from '@/lib/ids';
import { createFactCorrectionRepository } from '@/repositories/fact-correction.repository';
import type { FactCorrectionRepository } from '@/repositories/fact-correction.repository';
import { createLearnerBriefRepository } from '@/repositories/learner-brief.repository';
import { createLearnerEpisodeRepository } from '@/repositories/learner-episode.repository';
import type { LearnerEpisodeRepository } from '@/repositories/learner-episode.repository';
import type { NewFactCorrection } from '@/types/memory-history';

import { createTestDatabase, shouldSkipDatabaseTests } from './db.harness';
import {
  NOW,
  OTHER_STUDENT_ID,
  PARENT_ID,
  STUDENT_ID,
  brief,
  episode,
  seedFamily,
} from './memory-history.fixture';

import type { TestDatabase } from './db.harness';

const suite = shouldSkipDatabaseTests() ? describe.skip : describe;
const TABLES = [
  'learner_episode',
  'learner_episode_evidence',
  'learner_brief',
  'learner_fact_correction',
];

function correction(overrides: Partial<NewFactCorrection>): NewFactCorrection {
  return {
    correctedBy: 'parent',
    correctedById: PARENT_ID,
    studentId: STUDENT_ID,
    targetKind: 'episode',
    targetId: '00000000-0000-4000-8000-000000000999',
    replacementId: null,
    oldValue: { summary: 'old' },
    newValue: null,
    reason: 'That was her brother, not her.',
    at: NOW,
    ...overrides,
  } as NewFactCorrection;
}

suite('P3-01 correction history and erasure', () => {
  let database: TestDatabase;
  let corrections: FactCorrectionRepository;
  let episodes: LearnerEpisodeRepository;

  beforeAll(async () => {
    database = await createTestDatabase();
  }, 60_000);
  afterAll(async () => {
    await database.drop();
  });
  beforeEach(async () => {
    await database.truncateAll();
    await seedFamily(database);
    const ids = sequentialUuids();
    corrections = createFactCorrectionRepository({ db: database.pool, ids });
    episodes = createLearnerEpisodeRepository({ db: database.pool, ids });
  });

  it('records a replacement, even of a target that is already superseded', async () => {
    const first = await episodes.insert(episode());
    const second = await episodes.supersede(first.id, episode({ summary: 'Revised.' }));
    const saved = await corrections.insert(
      correction({
        targetId: first.id,
        replacementId: second.id,
        newValue: { summary: 'Revised.' },
      }),
    );
    expect(saved).toMatchObject({ correctedBy: 'parent', correctedById: PARENT_ID });
    expect(saved.replacementId).toBe(second.id);
    expect(await corrections.listForStudent(STUDENT_ID)).toEqual([saved]);
  });

  it('records a retraction: no replacement and no new value', async () => {
    const target = await episodes.insert(episode());
    const saved = await corrections.insert(
      correction({ targetId: target.id, correctedBy: 'child', correctedById: null }),
    );
    expect([saved.replacementId, saved.newValue, saved.correctedById]).toEqual([null, null, null]);
  });

  it('refuses a replacement that is not current, belongs to another child, or has no value', async () => {
    const first = await episodes.insert(episode());
    const second = await episodes.supersede(first.id, episode());
    const theirs = await episodes.insert(episode({ studentId: OTHER_STUDENT_ID }));
    const stale = correction({ targetId: second.id, replacementId: first.id, newValue: {} });
    const foreign = correction({ targetId: second.id, replacementId: theirs.id, newValue: {} });
    const valueless = correction({ targetId: second.id, replacementId: second.id });
    for (const bad of [stale, foreign, valueless])
      await expect(corrections.insert(bad)).rejects.toBeInstanceOf(ValidationError);
  });

  it('refuses a target that does not exist for this child', async () => {
    const theirs = await episodes.insert(episode({ studentId: OTHER_STUDENT_ID }));
    await expect(corrections.insert(correction({ targetId: theirs.id }))).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('enforces the author rule in the database, not only in the type', async () => {
    const target = await episodes.insert(episode());
    const anonymousParent = correction({ targetId: target.id }) as Record<string, unknown>;
    anonymousParent.correctedById = null;
    await expect(
      corrections.insert(anonymousParent as unknown as NewFactCorrection),
    ).rejects.toThrow();
  });

  it('erases every row in all four tables when the student is deleted', async () => {
    const target = await episodes.insert(episode());
    await episodes.addEvidence(target.id, [
      { sourceKind: 'child_writing', sourceId: '00000000-0000-4000-8000-000000000990' },
    ]);
    await createLearnerBriefRepository({ db: database.pool, ids: sequentialUuids() }).insertVersion(
      brief(),
    );
    await corrections.insert(correction({ targetId: target.id }));
    for (const table of TABLES) expect(await count(database, table)).toBeGreaterThan(0);

    await database.pool.query('DELETE FROM student WHERE id = $1', [STUDENT_ID]);
    for (const table of TABLES) expect(await count(database, table)).toBe(0);
  });

  it('can be re-applied over itself (IF NOT EXISTS)', async () => {
    const sql = await readFile(join(MIGRATIONS_DIR, '030_learner_episode_brief.sql'), 'utf8');
    await expect(database.pool.query(sql)).resolves.toBeDefined();
  });
});

async function count(database: TestDatabase, table: string): Promise<number> {
  // Table names come from the constant list above, never from input.
  const result = await database.pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM ${table}`,
  );
  return result.rows[0]?.n ?? -1;
}
