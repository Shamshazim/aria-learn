import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { sequentialUuids } from '@/lib/ids';
import { createLearnerMemoryRepository } from '@/repositories/learner-memory.repository';
import { createSessionEventRepository } from '@/repositories/session-event.repository';
import { createSessionRepository } from '@/repositories/session.repository';

import { createTestDatabase, shouldSkipDatabaseTests } from './db.harness';
import {
  createPhase1Fixture,
  parseArrival,
  requireAsk,
  sendTurn,
  startSession,
  waitForFact,
} from './phase1.acceptance.fixture';

import type { TestDatabase } from './db.harness';

const suite = shouldSkipDatabaseTests() ? describe.skip : describe;

suite('Phase 1 exit acceptance', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
  }, 60_000);
  beforeEach(async () => database.truncateAll());
  afterAll(async () => database.drop());

  it('greets a returning child from evidence and recommends due work', async () => {
    const fixture = await createPhase1Fixture(database, '4', sequentialUuids());
    const sessions = createSessionRepository({ db: database.pool, ids: fixture.ids });
    const events = createSessionEventRepository({
      db: database.pool,
      ids: fixture.ids,
      clock: fixture.clock,
    });
    const prior = await sessions.create({
      studentId: fixture.studentId,
      subject: 'writing',
      grade: '4',
      band: 'middle',
    });
    const evidence = await events.append({
      sessionId: prior.id,
      actor: 'aria',
      kind: 'PRAISE',
      text: 'You finished a practice step.',
      skillCode: 'WR.PARAGRAPH',
      correct: null,
      latencyMs: null,
      evidence: {},
      payload: {},
    });
    await sessions.end(prior.id, 'complete', fixture.clock.now());
    await createLearnerMemoryRepository({ db: database.pool, ids: fixture.ids }).insertFact({
      studentId: fixture.studentId,
      kind: 'practice_persistence',
      value: { text: 'Finished a writing practice step.', skillCode: 'WR.PARAGRAPH' },
      confidence: 0.95,
      firstObservedAt: fixture.clock.now(),
      lastConfirmedAt: fixture.clock.now(),
      expiresAt: null,
      sensitivity: 'normal',
      modelShareable: true,
      evidence: [{ sourceKind: 'session_event', sourceId: evidence.id }],
    });

    const response = parseArrival(
      await request(fixture.app).post('/api/v1/student/arrival').send({}).expect(200),
    );
    expect(response.moves[0]).toMatchObject({ kind: 'WELCOME' });
    expect(response.moves[0]?.kind === 'WELCOME' ? response.moves[0].basedOn : []).toHaveLength(1);
    expect(response.recommendedSubject).not.toBeNull();
  });

  it('records choosing a different class as declining the recommendation', async () => {
    const fixture = await createPhase1Fixture(database, '4', sequentialUuids());
    const arrival = parseArrival(
      await request(fixture.app).post('/api/v1/student/arrival').send({}).expect(200),
    );
    await request(fixture.app)
      .post('/api/v1/student/session')
      .send({
        subject: 'writing',
        grade: '4',
        arrivalId: arrival.arrivalId,
        fromRecommendation: true,
      })
      .expect(200);
    const result = await database.pool.query<{ accepted: boolean }>(
      'SELECT accepted FROM arrival_event WHERE id = $1',
      [arrival.arrivalId],
    );
    expect(result.rows[0]?.accepted).toBe(false);
  });

  it.each([
    ['1', 'math'],
    ['4', 'math'],
    ['7', 'writing'],
  ] as const)('runs a complete multi-turn Grade %s session', async (grade, subject) => {
    const fixture = await createPhase1Fixture(database, grade, sequentialUuids());
    const started = await startSession(fixture, grade, subject);
    let ask = requireAsk(started.moves);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await sendTurn(fixture, started.session.sessionId, {
        kind: 'ANSWER',
        respondsTo: ask.id,
        text: 'done',
      });
      ask = requireAsk(response.moves);
    }
    await request(fixture.app)
      .post('/api/v1/student/session/end')
      .send({ sessionId: started.session.sessionId, reason: 'complete' })
      .expect(200);
    await fixture.waitForBackground();
    const count = await database.pool.query<{ count: number }>(
      'SELECT COUNT(*)::int AS count FROM session_event WHERE session_id = $1',
      [started.session.sessionId],
    );
    expect(count.rows[0]?.count).toBeGreaterThanOrEqual(8);
  });

  it('changes the explanation structure after repeated confusion', async () => {
    const fixture = await createPhase1Fixture(database, '4', sequentialUuids());
    const started = await startSession(fixture, '4', 'math');
    await sendTurn(fixture, started.session.sessionId, { kind: 'CONFUSED' });
    await sendTurn(fixture, started.session.sessionId, { kind: 'CONFUSED' });
    const result = await database.pool.query<{ approach: string; text: string }>(
      `SELECT evidence ->> 'approach' AS approach, text FROM session_event
       WHERE session_id = $1 AND actor = 'aria' AND kind = 'RETEACH' ORDER BY seq`,
      [started.session.sessionId],
    );
    expect(result.rows.map((row) => row.approach)).toEqual(['visual-model', 'worked-example']);
    expect(new Set(result.rows.map((row) => row.text)).size).toBe(2);
  });

  it('recalls tomorrow only from a fact supported by today evidence', async () => {
    const fixture = await createPhase1Fixture(database, '1', sequentialUuids());
    const started = await startSession(fixture, '1', 'math');
    const ask = requireAsk(started.moves);
    await sendTurn(fixture, started.session.sessionId, {
      kind: 'ANSWER',
      respondsTo: ask.id,
      text: '10',
    });
    await request(fixture.app)
      .post('/api/v1/student/session/end')
      .send({ sessionId: started.session.sessionId, reason: 'complete' })
      .expect(200);
    await fixture.waitForBackground();
    const factId = await waitForFact(database, fixture.studentId);
    fixture.clock.advance(24 * 3_600_000);
    const arrival = parseArrival(
      await request(fixture.app).post('/api/v1/student/arrival').send({}).expect(200),
    );
    expect(arrival.moves[0]).toMatchObject({ kind: 'WELCOME', basedOn: [factId] });
    const evidence = await database.pool.query<{ count: number }>(
      'SELECT COUNT(*)::int AS count FROM learner_fact_evidence WHERE fact_id = $1',
      [factId],
    );
    expect(evidence.rows[0]?.count).toBeGreaterThan(0);
  });
});
