import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION, tutorMoveSchema } from '@aria/shared';

import { sequentialUuids } from '@/lib/ids';
import { createMoveOutboxRepository } from '@/repositories/move-outbox.repository';
import { createSessionRepository } from '@/repositories/session.repository';
import { createVoiceSessionRepository } from '@/repositories/voice-session.repository';

import { createTestDatabase, shouldSkipDatabaseTests } from './db.harness';

import type { TestDatabase } from './db.harness';

const suite = shouldSkipDatabaseTests() ? describe.skip : describe;
const NOW = new Date('2026-08-24T20:00:00.000Z');

suite('voice move outbox repository', () => {
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

  it('assigns ordered sequences, de-duplicates moves and resumes after the acknowledged cursor', async () => {
    const sessions = createSessionRepository({ db: database.pool, ids: sequentialUuids() });
    const session = await sessions.create({
      studentId,
      subject: 'math',
      grade: '4',
      band: 'middle',
    });
    const voiceSessions = createVoiceSessionRepository(database.pool);
    await expect(
      voiceSessions.open({ sessionId: session.id, region: 'us-west', processorMap: {} }),
    ).resolves.toBe(0);
    const outbox = createMoveOutboxRepository({ db: database.pool, ids: sequentialUuids() });
    const first = move(session.id, 'move-1', 'First.');
    const second = move(session.id, 'move-2', 'Second.');
    await outbox.enqueueIfOpen(session.id, first);
    await outbox.enqueueIfOpen(session.id, first);
    await outbox.enqueueIfOpen(session.id, second);

    const pending = await outbox.listAfter(session.id, 0);
    expect(pending.map((item) => item.serverSeq)).toEqual([1, 3]);
    expect(pending[0]?.move).toMatchObject({ id: 'move-1', serverSeq: 1 });
    await outbox.acknowledge(session.id, 1, NOW);
    await expect(outbox.listAfter(session.id, 1)).resolves.toHaveLength(1);
    await expect(
      voiceSessions.open({ sessionId: session.id, region: 'us-west', processorMap: {} }),
    ).resolves.toBe(1);
  });
});

function move(sessionId: string, id: string, text: string) {
  return tutorMoveSchema.parse({
    id,
    at: NOW.toISOString(),
    protocolVersion: PROTOCOL_VERSION,
    sessionId,
    kind: 'SAY',
    speech: { text },
    display: [],
    expects: 'none',
  });
}

async function insertStudent(database: TestDatabase): Promise<string> {
  const parentId = '00000000-0000-4000-8000-000000000501';
  const id = '00000000-0000-4000-8000-000000000502';
  await database.pool.query("INSERT INTO parent (id, display_name) VALUES ($1, 'Parent')", [
    parentId,
  ]);
  await database.pool.query(
    "INSERT INTO student (id, parent_id, display_name, grade, band) VALUES ($1, $2, 'Child', '4', 'middle')",
    [id, parentId],
  );
  return id;
}
