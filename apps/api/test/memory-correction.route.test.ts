import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { childSummarySchema } from '@aria/shared';

import { uuidGenerator } from '@/lib/ids';
import { createLearnerMemoryRepository } from '@/repositories/learner-memory.repository';
import { createParentRepository } from '@/repositories/parent.repository';
import { createStudentRepository } from '@/repositories/student.repository';
import { parseEnvelope } from '@/testing/envelope';

import { createTestDatabase, shouldSkipDatabaseTests } from './db.harness';
import { buildHarness, PARENT_TOKEN, type Harness } from './identity.fixture';

import type { TestDatabase } from './db.harness';

const suite = shouldSkipDatabaseTests() ? describe.skip : describe;
const AT = new Date('2026-08-25T09:00:00.000Z');
const RANDOM_ID = '00000000-0000-4000-8000-00000000ffff';

suite('P3-06 POST /parent/children/:id/learner-memory/correct', () => {
  let database: TestDatabase;
  let harness: Harness;

  beforeAll(async () => {
    database = await createTestDatabase();
  }, 60_000);
  afterAll(async () => database.drop());
  beforeEach(async () => {
    await database.truncateAll();
    harness = buildHarness(database);
  });

  const correct = (childId: string, body: Readonly<Record<string, unknown>>) =>
    request(harness.app)
      .post(`/api/v1/parent/children/${childId}/learner-memory/correct`)
      .set('authorization', `Bearer ${PARENT_TOKEN}`)
      .send(body);

  async function ownChild(): Promise<string> {
    const response = await request(harness.app)
      .post('/api/v1/parent/children')
      .set('authorization', `Bearer ${PARENT_TOKEN}`)
      .send({ displayName: 'Sam', grade: '4', avatar: 'owl' })
      .expect(201);
    return parseEnvelope(childSummarySchema, response).id;
  }

  async function strangersChild(): Promise<string> {
    const parent = await createParentRepository({ db: database.db, ids: uuidGenerator }).insert({
      email: 'someone.else@example.test',
      displayName: 'Someone else',
    });
    const child = await createStudentRepository({ db: database.db, ids: uuidGenerator }).insert({
      parentId: parent.id,
      displayName: 'Kit',
      grade: '3',
    });
    return child.id;
  }

  async function preference(studentId: string, text: string): Promise<string> {
    const fact = await createLearnerMemoryRepository({
      db: database.db,
      ids: uuidGenerator,
    }).insertFact({
      studentId,
      kind: 'preference',
      value: { text },
      confidence: 0.9,
      firstObservedAt: AT,
      lastConfirmedAt: AT,
      expiresAt: null,
      sensitivity: 'normal',
      modelShareable: true,
      evidence: [{ sourceKind: 'session_event', sourceId: uuidGenerator.next() }],
    });
    return fact.id;
  }

  it("replaces a fact for the parent's own child", async () => {
    const childId = await ownChild();
    const factId = await preference(childId, 'Loves space stories.');
    const response = await correct(childId, {
      targetKind: 'fact',
      targetId: factId,
      action: 'replace',
      newValue: { text: 'Loves mystery stories.' },
    });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ data: { status: 'applied' } });
  });

  it("answers another family's child, their fact, and a random id with the same 404", async () => {
    const childId = await ownChild();
    const theirChild = await strangersChild();
    const theirFact = await preference(theirChild, 'Loves trains.');
    const bodies = await Promise.all([
      correct(theirChild, { targetKind: 'fact', targetId: theirFact, action: 'retract' }),
      correct(childId, { targetKind: 'fact', targetId: theirFact, action: 'retract' }),
      correct(RANDOM_ID, { targetKind: 'fact', targetId: RANDOM_ID, action: 'retract' }),
      correct(childId, { targetKind: 'fact', targetId: RANDOM_ID, action: 'retract' }),
    ]);
    expect(bodies.map((response) => response.status)).toEqual([404, 404, 404, 404]);
    const shapes = bodies.map((response) => {
      const { requestId: _requestId, ...rest } = (
        response.body as { error: Record<string, unknown> }
      ).error;
      return rest;
    });
    expect(new Set(shapes.map((shape) => JSON.stringify(shape))).size).toBe(1);
  });

  it('refuses a judging replacement with 422 and the rule, so the parent can rephrase', async () => {
    const childId = await ownChild();
    const factId = await preference(childId, 'Loves space stories.');
    const response = await correct(childId, {
      targetKind: 'fact',
      targetId: factId,
      action: 'replace',
      newValue: { text: 'He is lazy about reading.' },
    });
    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({
      error: { code: 'VALUE_REJECTED', details: { rule: 'judgement' } },
    });
  });

  it('refuses a replace without a value before it reaches the service', async () => {
    const childId = await ownChild();
    const factId = await preference(childId, 'Loves space stories.');
    const response = await correct(childId, {
      targetKind: 'fact',
      targetId: factId,
      action: 'replace',
    });
    expect(response.status).toBe(400);
  });
});
