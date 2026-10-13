import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ConflictError, ValidationError } from '@/errors';
import { sequentialUuids } from '@/lib/ids';
import { createLearnerEpisodeRepository } from '@/repositories/learner-episode.repository';
import type { LearnerEpisodeRepository } from '@/repositories/learner-episode.repository';

import { createTestDatabase, shouldSkipDatabaseTests } from './db.harness';
import {
  NOW,
  OTHER_STUDENT_ID,
  SKILL_CODE,
  STUDENT_ID,
  episode,
  evidenceId,
  seedFamily,
} from './memory-history.fixture';

import type { TestDatabase } from './db.harness';

const suite = shouldSkipDatabaseTests() ? describe.skip : describe;
const HOUR = 3_600_000;

suite('P3-01 learner episode repository', () => {
  let database: TestDatabase;
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
    episodes = createLearnerEpisodeRepository({ db: database.pool, ids: sequentialUuids() });
  });

  it('inserts an episode with its evidence and returns the domain record', async () => {
    const saved = await episodes.insert(episode());
    expect(saved).toMatchObject({
      studentId: STUDENT_ID,
      kind: 'breakthrough',
      importance: 0.8,
      skillCode: SKILL_CODE,
      supersededBy: null,
    });
    expect(saved.at).toEqual(NOW);
    expect(await episodes.hasEvidence('session_event', evidenceId(1))).toBe(true);
    expect(await episodes.hasEvidence('oral_reading', evidenceId(1))).toBe(false);
  });

  it('lists current episodes newest first and leaves out expired ones', async () => {
    const older = await episodes.insert(episode({ at: new Date(NOW.getTime() - 2 * HOUR) }));
    const newer = await episodes.insert(episode({ at: new Date(NOW.getTime() - HOUR) }));
    const expired = await episodes.insert(
      episode({ kind: 'struggle', expiresAt: new Date(NOW.getTime() - 1) }),
    );
    const current = await episodes.listCurrent(STUDENT_ID, NOW);
    expect(current.map((e) => e.id)).toEqual([newer.id, older.id]);
    const stored = await database.pool.query('SELECT 1 FROM learner_episode WHERE id = $1', [
      expired.id,
    ]);
    expect(stored.rowCount).toBe(1); // expired rows stay for audit
  });

  it('supersedes without deleting, and never lists the superseded row', async () => {
    const first = await episodes.insert(episode());
    const replacement = await episodes.supersede(
      first.id,
      episode({ summary: 'Carried the ten in two of three tries.', importance: 0.6 }),
    );
    expect((await episodes.listCurrent(STUDENT_ID, NOW)).map((e) => e.id)).toEqual([
      replacement.id,
    ]);
    const old = await database.pool.query<{ superseded_by: string }>(
      'SELECT superseded_by FROM learner_episode WHERE id = $1',
      [first.id],
    );
    expect(old.rows[0]?.superseded_by).toBe(replacement.id);
  });

  it('refuses to supersede a row that is not current, or another child’s row', async () => {
    const first = await episodes.insert(episode());
    await episodes.supersede(first.id, episode());
    await expect(episodes.supersede(first.id, episode())).rejects.toBeInstanceOf(ConflictError);

    const mine = await episodes.insert(episode());
    await expect(
      episodes.supersede(mine.id, episode({ studentId: OTHER_STUDENT_ID })),
    ).rejects.toBeInstanceOf(ConflictError);
    const count = await database.pool.query('SELECT 1 FROM learner_episode');
    expect(count.rowCount).toBe(3); // the refused replacements were never written
  });

  it('adds evidence idempotently', async () => {
    const saved = await episodes.insert(episode());
    const more = [{ sourceKind: 'oral_reading' as const, sourceId: evidenceId(2) }];
    await episodes.addEvidence(saved.id, more);
    await episodes.addEvidence(saved.id, more);
    const rows = await database.pool.query(
      'SELECT 1 FROM learner_episode_evidence WHERE episode_id = $1',
      [saved.id],
    );
    expect(rows.rowCount).toBe(2);
    expect(await episodes.hasEvidence('oral_reading', evidenceId(2))).toBe(true);
  });

  it('rejects an episode with no evidence, an empty summary or an out-of-range importance', async () => {
    const noEvidence = { ...episode(), evidence: [] } as unknown as Parameters<
      LearnerEpisodeRepository['insert']
    >[0];
    await expect(episodes.insert(noEvidence)).rejects.toBeInstanceOf(ValidationError);
    await expect(episodes.insert(episode({ summary: '   ' }))).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(episodes.insert(episode({ importance: 1.5 }))).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('keeps an episode when its skill is removed, and drops it with its session', async () => {
    const saved = await episodes.insert(episode());
    await database.pool.query('DELETE FROM skill WHERE code = $1', [SKILL_CODE]);
    const [kept] = await episodes.listCurrent(STUDENT_ID, NOW);
    expect(kept?.id).toBe(saved.id);
    expect(kept?.skillCode).toBeNull();
    await database.pool.query('DELETE FROM session');
    expect(await episodes.listCurrent(STUDENT_ID, NOW)).toEqual([]);
    expect(await episodes.hasEvidence('session_event', evidenceId(1))).toBe(false);
  });
});
