import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { sequentialUuids } from '@/lib/ids';
import { createLearnerMemoryRepository } from '@/repositories/learner-memory.repository';

import { createTestDatabase, shouldSkipDatabaseTests } from './db.harness';
import {
  createPhase1Fixture,
  requireAsk,
  sendTurn,
  startSession,
} from './phase1.acceptance.fixture';

import type { TestDatabase } from './db.harness';

const suite = shouldSkipDatabaseTests() ? describe.skip : describe;

suite('P3-06 a child correcting their own memory, mid-lesson', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
  }, 60_000);
  afterAll(async () => database.drop());
  beforeEach(async () => database.truncateAll());

  it('retracts the preference, says one sentence, and goes back to the question', async () => {
    const fixture = await createPhase1Fixture(database, '2', sequentialUuids());
    const memory = createLearnerMemoryRepository({ db: database.pool, ids: fixture.ids });
    await memory.insertFact({
      studentId: fixture.studentId,
      kind: 'preference',
      value: { text: 'Loves monster trucks.' },
      confidence: 0.9,
      firstObservedAt: fixture.clock.now(),
      lastConfirmedAt: fixture.clock.now(),
      expiresAt: null,
      sensitivity: 'normal',
      modelShareable: true,
      evidence: [{ sourceKind: 'session_event', sourceId: fixture.ids.next() }],
    });
    const started = await startSession(fixture, '2', 'math');
    const ask = requireAsk(started.moves);

    const reply = await sendTurn(fixture, started.session.sessionId, {
      kind: 'ANSWER',
      respondsTo: ask.id,
      text: "I don't like trucks anymore",
    });

    const said = reply.moves.find((move) => move.kind === 'SAY');
    expect(said?.speech?.text).toBe('Got it, no more trucks.');
    expect(reply.moves.at(-1)?.kind).toBe('ASK');
    expect(await memory.listCurrent(fixture.studentId, fixture.clock.now())).toEqual([]);
    const audit = await database.pool.query<{
      corrected_by: string;
      replacement_id: string | null;
    }>('SELECT corrected_by, replacement_id FROM learner_fact_correction WHERE student_id = $1', [
      fixture.studentId,
    ]);
    expect(audit.rows).toEqual([{ corrected_by: 'child', replacement_id: null }]);
    const graded = await database.pool.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM session_event
       WHERE session_id = $1 AND actor = 'child' AND correct IS NOT NULL`,
      [started.session.sessionId],
    );
    expect(graded.rows[0]?.count).toBe(0);
  });

  it('acknowledges a correction that matches nothing, and changes nothing', async () => {
    const fixture = await createPhase1Fixture(database, '2', sequentialUuids());
    const started = await startSession(fixture, '2', 'math');
    const reply = await sendTurn(fixture, started.session.sessionId, {
      kind: 'ANSWER',
      respondsTo: requireAsk(started.moves).id,
      text: "I don't like football anymore",
    });
    expect(reply.moves.find((move) => move.kind === 'SAY')?.speech?.text).toBe(
      'Got it, no more football.',
    );
    const audit = await database.pool.query<{ count: number }>(
      'SELECT COUNT(*)::int AS count FROM learner_fact_correction',
    );
    expect(audit.rows[0]?.count).toBe(0);
  });
});
