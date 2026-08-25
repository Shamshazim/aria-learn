import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { fixedClock } from '@/lib/clock';
import { sequentialUuids } from '@/lib/ids';
import { createSessionEventRepository } from '@/repositories/session-event.repository';
import { createSessionRepository } from '@/repositories/session.repository';

import { createTestDatabase, shouldSkipDatabaseTests } from './db.harness';

import type { TestDatabase } from './db.harness';

const suite = shouldSkipDatabaseTests() ? describe.skip : describe;
const NOW = new Date('2026-08-24T20:00:00.000Z');

suite('Phase 1 session repositories', () => {
  let database: TestDatabase;
  let studentId: string;

  beforeAll(async () => {
    database = await createTestDatabase();
  }, 60_000);
  afterAll(async () => {
    await database.drop();
  });
  beforeEach(async () => {
    await database.truncateAll();
    studentId = await insertStudent(database);
  });

  it('enforces one open session and keeps the first end reason', async () => {
    const sessions = createSessionRepository({ db: database.pool, ids: sequentialUuids() });
    const created = await sessions.create({
      studentId,
      subject: 'math',
      grade: '4',
      band: 'middle',
    });
    await expect(sessions.findOpen(studentId)).resolves.toEqual(created);
    await expect(
      sessions.create({ studentId, subject: 'reading', grade: '4', band: 'middle' }),
    ).rejects.toMatchObject({ status: 409 });
    await sessions.end(created.id, 'break', NOW);
    const second = await sessions.end(created.id, 'complete', new Date(NOW.getTime() + 1_000));
    expect(second).toMatchObject({ endReason: 'break', endedAt: NOW });
    await expect(sessions.findOpen(studentId)).resolves.toBeNull();
  });

  it('allocates a gapless event sequence under concurrent appends', async () => {
    const sessions = createSessionRepository({ db: database.pool, ids: sequentialUuids() });
    const session = await sessions.create({
      studentId,
      subject: 'math',
      grade: '4',
      band: 'middle',
    });
    const events = createSessionEventRepository({
      db: database.pool,
      ids: sequentialUuids(),
      clock: fixedClock(NOW),
    });
    await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        events.append({
          sessionId: session.id,
          actor: 'system',
          kind: 'test',
          text: null,
          skillCode: null,
          correct: null,
          latencyMs: null,
          evidence: { index },
          payload: { index },
        }),
      ),
    );
    expect((await events.list(session.id)).map((event) => event.seq)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1),
    );
  });

  it('cascades sessions and events when the student is deleted', async () => {
    const sessions = createSessionRepository({ db: database.pool, ids: sequentialUuids() });
    const session = await sessions.create({
      studentId,
      subject: 'math',
      grade: '4',
      band: 'middle',
    });
    const events = createSessionEventRepository({
      db: database.pool,
      ids: sequentialUuids(),
      clock: fixedClock(NOW),
    });
    await events.append({
      sessionId: session.id,
      actor: 'system',
      kind: 'test',
      text: null,
      skillCode: null,
      correct: null,
      latencyMs: null,
      evidence: {},
      payload: {},
    });
    await database.pool.query('DELETE FROM student WHERE id = $1', [studentId]);
    const result = await database.pool.query<{ count: string }>(
      'SELECT count(*) FROM session_event',
    );
    expect(result.rows[0]?.count).toBe('0');
  });
});

async function insertStudent(database: TestDatabase): Promise<string> {
  const parentId = '00000000-0000-4000-8000-000000000401';
  const id = '00000000-0000-4000-8000-000000000402';
  await database.pool.query("INSERT INTO parent (id, display_name) VALUES ($1, 'Parent')", [
    parentId,
  ]);
  await database.pool.query(
    "INSERT INTO student (id, parent_id, display_name, grade, band) VALUES ($1, $2, 'Child', '4', 'middle')",
    [id, parentId],
  );
  return id;
}
