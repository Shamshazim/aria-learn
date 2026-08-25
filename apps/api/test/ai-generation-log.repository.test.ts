import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { sequentialUuids } from '@/lib/ids';
import { createAiGenerationLogRepository } from '@/repositories/ai-generation-log.repository';

import { createTestDatabase, shouldSkipDatabaseTests } from './db.harness';

import type { TestDatabase } from './db.harness';

const suite = shouldSkipDatabaseTests() ? describe.skip : describe;

suite('AI generation log repository', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
  }, 60_000);

  afterAll(async () => {
    await database.drop();
  });

  it('stores cost without content and cascades when the student is deleted', async () => {
    const studentId = await insertStudent(database);
    const repository = createAiGenerationLogRepository({
      db: database.pool,
      ids: sequentialUuids(),
    });

    await repository.insert({
      studentId,
      endpointName: 'test-endpoint',
      model: 'test-model',
      tier: 'FAST',
      promptName: 'practice-item',
      promptVersion: '1.0.0',
      tokensIn: 100,
      tokensOut: 20,
      latencyMs: 25,
      costUsd: 0.002,
      cached: false,
      ok: true,
    });

    expect(await repository.daySpend(studentId, new Date())).toBe(0.002);
    await database.pool.query('DELETE FROM student WHERE id = $1', [studentId]);
    const { rows } = await database.pool.query<{ count: string }>(
      'SELECT count(*) FROM ai_generation_log',
    );
    expect(rows[0]?.count).toBe('0');
  });
});

async function insertStudent(database: TestDatabase): Promise<string> {
  const parentId = '00000000-0000-4000-8000-000000000101';
  const studentId = '00000000-0000-4000-8000-000000000102';
  await database.pool.query("INSERT INTO parent (id, display_name) VALUES ($1, 'Parent')", [
    parentId,
  ]);
  await database.pool.query(
    "INSERT INTO student (id, parent_id, display_name, grade, band) VALUES ($1, $2, 'Child', '3', 'middle')",
    [studentId, parentId],
  );
  return studentId;
}
