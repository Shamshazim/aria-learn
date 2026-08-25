import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { fixedClock } from '@/lib/clock';
import { sequentialUuids } from '@/lib/ids';
import { createContentItemRepository } from '@/repositories/content-item.repository';

import { createTestDatabase, shouldSkipDatabaseTests } from './db.harness';

import type { TestDatabase } from './db.harness';

const suite = shouldSkipDatabaseTests() ? describe.skip : describe;

suite('content item repository', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
  }, 60_000);

  afterAll(async () => {
    await database.drop();
  });

  it('never returns one child personal content to another child', async () => {
    const [studentA, studentB] = await insertStudents(database);
    const repository = createContentItemRepository({
      db: database.pool,
      ids: sequentialUuids(),
      clock: fixedClock(new Date('2026-08-24T00:00:00Z')),
    });
    const draft = {
      kind: 'question',
      skillCode: 'ADD.FACT.10',
      band: 'early',
      body: { prompt: 'What is next?' },
      scope: { kind: 'personalised', studentId: studentA },
    } as const;

    await repository.insert(draft, studentA);

    await expect(repository.findEligible({ ...draft, studentId: studentB })).resolves.toBeNull();
    await database.pool.query('DELETE FROM student WHERE id = $1', [studentA]);
    const { rows } = await database.pool.query<{ count: string }>(
      'SELECT count(*) FROM content_item',
    );
    expect(rows[0]?.count).toBe('0');
  });

  it('does not immediately repeat an excluded recent item', async () => {
    await database.truncateAll();
    const [student] = await insertStudents(database);
    const repository = createContentItemRepository({
      db: database.pool,
      ids: sequentialUuids(),
      clock: fixedClock(new Date('2026-08-24T00:00:00Z')),
    });
    const draft = {
      kind: 'question',
      skillCode: 'ADD.FACT.10',
      band: 'early',
      body: { prompt: 'What is next?' },
      scope: { kind: 'shareable' },
    } as const;
    const first = await repository.insert(draft, null);
    const second = await repository.insert(
      { ...draft, body: { prompt: 'What comes after?' } },
      null,
    );

    await expect(
      repository.findEligible({
        kind: draft.kind,
        skillCode: draft.skillCode,
        band: draft.band,
        studentId: student,
        excludeIds: [first.id],
      }),
    ).resolves.toMatchObject({ id: second.id });
  });
});

async function insertStudents(database: TestDatabase): Promise<readonly [string, string]> {
  const parentId = '00000000-0000-4000-8000-000000000201';
  const studentA = '00000000-0000-4000-8000-000000000202';
  const studentB = '00000000-0000-4000-8000-000000000203';
  await database.pool.query("INSERT INTO parent (id, display_name) VALUES ($1, 'Parent')", [
    parentId,
  ]);
  await database.pool.query(
    `INSERT INTO student (id, parent_id, display_name, grade, band)
     VALUES ($1, $3, 'Child A', '2', 'early'), ($2, $3, 'Child B', '2', 'early')`,
    [studentA, studentB, parentId],
  );
  return [studentA, studentB];
}
