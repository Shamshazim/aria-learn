import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ValidationError } from '@/errors';
import { sequentialUuids, uuidGenerator } from '@/lib/ids';
import { createLearnerBriefRepository } from '@/repositories/learner-brief.repository';
import type { LearnerBriefRepository } from '@/repositories/learner-brief.repository';

import { createTestDatabase, shouldSkipDatabaseTests } from './db.harness';
import { STUDENT_ID, brief, seedFamily } from './memory-history.fixture';

import type { TestDatabase } from './db.harness';

const suite = shouldSkipDatabaseTests() ? describe.skip : describe;

suite('P3-01 learner brief repository', () => {
  let database: TestDatabase;
  let briefs: LearnerBriefRepository;

  beforeAll(async () => {
    database = await createTestDatabase();
  }, 60_000);
  afterAll(async () => {
    await database.drop();
  });
  beforeEach(async () => {
    await database.truncateAll();
    await seedFamily(database);
    briefs = createLearnerBriefRepository({ db: database.pool, ids: sequentialUuids() });
  });

  it('numbers versions per period and keeps exactly one current', async () => {
    const v1 = await briefs.insertVersion(brief());
    const v2 = await briefs.insertVersion(brief({ body: 'A second, rebuilt paragraph.' }));
    expect([v1.version, v2.version]).toEqual([1, 2]);
    expect(v1.periodStart).toBe('2026-10-05');
    expect(await briefs.current(STUDENT_ID, 'week', '2026-10-05')).toEqual(v2);
    const history = await briefs.history(STUDENT_ID, 'week');
    expect(history.map((b) => [b.version, b.supersededBy])).toEqual([
      [2, null],
      [1, v2.id],
    ]);
  });

  it('versions each period independently', async () => {
    await briefs.insertVersion(brief());
    const nextWeek = await briefs.insertVersion(brief({ periodStart: '2026-10-12' }));
    const month = await briefs.insertVersion(brief({ period: 'month', periodStart: '2026-10-01' }));
    expect([nextWeek.version, month.version]).toEqual([1, 1]);
    expect(await briefs.current(STUDENT_ID, 'week', '2026-10-05')).not.toBeNull();
    expect(await briefs.current(STUDENT_ID, 'year', '2026-01-01')).toBeNull();
  });

  it('finds the current brief by superseded_by, not by the highest number (gaps allowed)', async () => {
    const v1 = await briefs.insertVersion(brief());
    // A gap: version 4 written out of band and already retired in favour of v1.
    await database.pool.query(
      `INSERT INTO learner_brief (id, student_id, period, period_start, version, body,
         evidence_snapshot, generator, superseded_by)
       VALUES (gen_random_uuid(), $1, 'week', '2026-10-05', 4, 'retired', '{"factIds":[],
         "episodeIds":[],"skillCodes":[]}', 'g', $2)`,
      [STUDENT_ID, v1.id],
    );
    expect((await briefs.current(STUDENT_ID, 'week', '2026-10-05'))?.id).toBe(v1.id);
    const next = await briefs.insertVersion(brief());
    expect(next.version).toBe(5);
  });

  it('retries once when a concurrent writer takes its version number', async () => {
    const holder = await database.pool.connect();
    try {
      await holder.query('BEGIN');
      const inFlight = createLearnerBriefRepository({ db: holder, ids: uuidGenerator });
      const first = await inFlight.insertVersion(brief({ body: 'Writer A.' }));
      expect(first.version).toBe(1);

      // Writer B cannot see A's uncommitted row, also picks version 1, and waits on the index.
      const second = createLearnerBriefRepository({
        db: database.pool,
        ids: uuidGenerator,
      }).insertVersion(brief({ body: 'Writer B.' }));
      await new Promise((resolve) => setTimeout(resolve, 300));
      await holder.query('COMMIT');

      const won = await second;
      expect(won.version).toBe(2);
      expect((await briefs.current(STUDENT_ID, 'week', '2026-10-05'))?.id).toBe(won.id);
      const history = await briefs.history(STUDENT_ID, 'week');
      expect(history.find((b) => b.version === 1)?.supersededBy).toBe(won.id);
    } finally {
      holder.release();
    }
  });

  it('round-trips the evidence snapshot and validates its inputs', async () => {
    const snapshot = { factIds: ['f1'], episodeIds: ['e1', 'e2'], skillCodes: ['add.1'] };
    const saved = await briefs.insertVersion(brief({ evidenceSnapshot: snapshot }));
    expect(saved.evidenceSnapshot).toEqual(snapshot);
    for (const bad of [
      brief({ periodStart: '05/10/2026' }),
      brief({ periodStart: '2026-13-45' }),
      brief({ body: ' ' }),
      brief({ generator: 'x'.repeat(65) }),
    ]) {
      await expect(briefs.insertVersion(bad)).rejects.toBeInstanceOf(ValidationError);
    }
  });
});
