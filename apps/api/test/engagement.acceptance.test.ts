import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { engagementResponseSchema, PROTOCOL_VERSION, type EngagementResponse } from '@aria/shared';

import { sequentialUuids } from '@/lib/ids';

import { createTestDatabase, shouldSkipDatabaseTests } from './db.harness';
import {
  createPhase1Fixture,
  sendTurn,
  startSession,
  type Phase1Fixture,
} from './phase1.acceptance.fixture';

import type { TestDatabase } from './db.harness';

const suite = shouldSkipDatabaseTests() ? describe.skip : describe;

async function signal(
  fixture: Phase1Fixture,
  sessionId: string,
  payload: Readonly<{ signal: string; hiddenMs: number }>,
): Promise<EngagementResponse> {
  const response = await request(fixture.app)
    .post('/api/v1/student/session/engagement')
    .send({
      protocolVersion: PROTOCOL_VERSION,
      sessionId,
      event: {
        id: fixture.ids.next(),
        at: fixture.clock.now().toISOString(),
        protocolVersion: PROTOCOL_VERSION,
        sessionId,
        kind: 'ENGAGEMENT_SIGNAL',
        ...payload,
      },
    });
  if (response.status !== 200)
    throw new Error(`engagement returned ${String(response.status)}: ${response.text}`);
  return engagementResponseSchema.parse((response.body as { data: unknown }).data);
}

async function engagementRows(database: TestDatabase, sessionId: string) {
  const result = await database.pool.query<{ evidence: Record<string, unknown> }>(
    `SELECT evidence FROM session_event
     WHERE session_id = $1 AND actor = 'system' AND kind = 'ENGAGEMENT' ORDER BY seq`,
    [sessionId],
  );
  return result.rows.map((row) => row.evidence);
}

suite('P3-05 engagement, end to end', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
  }, 60_000);
  beforeEach(async () => database.truncateAll());
  afterAll(async () => database.drop());

  it('checks in on an idle child, logs the inference, and counts "keep going" as a false positive', async () => {
    const fixture = await createPhase1Fixture(database, '1', sequentialUuids());
    const started = await startSession(fixture, '1', 'math');
    const sessionId = started.session.sessionId;

    const checkIn = (await signal(fixture, sessionId, { signal: 'idle', hiddenMs: 45_000 }))
      .moves[0];
    expect(checkIn).toMatchObject({ kind: 'CHECK_IN', expects: 'choice', about: 'preference' });
    expect(checkIn?.speech?.text.trim().endsWith('?')).toBe(true);
    const choices = checkIn?.display.find((item) => item.type === 'choices');
    expect(choices?.type === 'choices' ? choices.options.map((option) => option.id) : []).toEqual([
      'switch',
      'keep',
    ]);
    expect(await engagementRows(database, sessionId)).toEqual([
      expect.objectContaining({
        engagementState: 'disengaged',
        engagementConfidence: 0.4,
        engagementSignals: 'idle',
        engagementDecision: 'check_in',
        trigger: 'ENGAGEMENT_SIGNAL',
      }),
    ]);

    const reply = await sendTurn(fixture, sessionId, {
      kind: 'ANSWER',
      respondsTo: checkIn?.id ?? 'missing',
      choiceId: 'keep',
    });
    expect(reply.moves.some((move) => move.kind === 'ASK')).toBe(true);
    const rows = await engagementRows(database, sessionId);
    expect(rows.at(-1)).toMatchObject({
      engagementDenied: 'disengaged',
      engagementFalsePositive: true,
      engagementDecision: 'reply_keep',
    });

    // Asked once and told no: the same signal again is recorded and says nothing.
    const again = await signal(fixture, sessionId, { signal: 'idle', hiddenMs: 45_000 });
    expect(again.moves).toEqual([]);
  });

  it('records a short tab switch without showing the child anything', async () => {
    const fixture = await createPhase1Fixture(database, '4', sequentialUuids());
    const started = await startSession(fixture, '4', 'math');
    const quiet = await signal(fixture, started.session.sessionId, {
      signal: 'tab_hidden',
      hiddenMs: 8_000,
    });
    expect(quiet.moves).toEqual([]);
    const logged = await database.pool.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM session_event
       WHERE session_id = $1 AND actor = 'child' AND kind = 'ENGAGEMENT_SIGNAL'`,
      [started.session.sessionId],
    );
    expect(logged.rows[0]?.count).toBe(1);
    expect(await engagementRows(database, started.session.sessionId)).toEqual([
      expect.objectContaining({ engagementSignals: 'tab_hidden', engagementDecision: 'none' }),
    ]);
  });
});
