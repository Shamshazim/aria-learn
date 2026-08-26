import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { childListResponseSchema, childSummarySchema } from '@aria/shared';

import { CHILD_SESSION_IDLE_MS, MAX_ATTEMPTS } from '@/auth';
import { parseEnvelope, parseError } from '@/testing/envelope';

import { createTestDatabase, shouldSkipDatabaseTests } from './db.harness';
import {
  buildHarness,
  cookieFrom,
  PARENT_EMAIL,
  PARENT_TOKEN,
  type Harness,
} from './identity.fixture';

import type { TestDatabase } from './db.harness';

/**
 * The whole identity path, end to end, against a real database and a real Argon2 (P2H-12).
 *
 * Parent signs in, adds a child, gives them a PIN; the child signs in on the same device and
 * reaches their session. Every refusal along the way is checked as carefully as the successes.
 */
const suite = shouldSkipDatabaseTests() ? describe.skip : describe;

suite('a family signing in', () => {
  let database: TestDatabase;
  let harness: Harness;

  beforeAll(async () => {
    database = await createTestDatabase();
  }, 60_000);

  afterAll(async () => {
    await database.drop();
  });

  beforeEach(async () => {
    await database.truncateAll();
    harness = buildHarness(database);
  });

  const asParent = (path: string) =>
    request(harness.app).post(path).set('authorization', `Bearer ${PARENT_TOKEN}`);

  const addChild = async (displayName = 'Sam', avatar = 'owl'): Promise<string> => {
    const response = await asParent('/api/v1/parent/children')
      .send({ displayName, grade: '4', avatar })
      .expect(201);
    return parseEnvelope(childSummarySchema, response).id;
  };

  const setPin = async (childId: string, pin: string): Promise<void> => {
    await request(harness.app)
      .patch(`/api/v1/parent/children/${childId}`)
      .set('authorization', `Bearer ${PARENT_TOKEN}`)
      .send({ login: { pin } })
      .expect(200);
  };

  const signIn = async (childId: string, pin: string): Promise<string> => {
    const response = await asParent('/api/v1/auth/child/login').send({ childId, pin }).expect(200);
    return cookieFrom(response);
  };

  it('goes from a parent signing up to a child reaching their session', async () => {
    const childId = await addChild();
    await setPin(childId, '4321');

    const cookie = await signIn(childId, '4321');
    const reached = await request(harness.app)
      .post('/api/v1/student/arrival')
      .set('Cookie', cookie)
      .send({});

    expect(reached.status).toBe(200);
    expect(reached.text).toContain(childId);
  });

  /** The parent row is created by the first authenticated call, not by a webhook. */
  it('creates the family on the first call and reuses it on the second', async () => {
    await addChild('Sam', 'owl');
    await addChild('Ada', 'whale');

    const listed = await request(harness.app)
      .get('/api/v1/parent/children')
      .set('authorization', `Bearer ${PARENT_TOKEN}`)
      .expect(200);

    expect(parseEnvelope(childListResponseSchema, listed).children).toHaveLength(2);
  });

  /**
   * The ticket's edge case: two children called the same thing. Migration 009 stopped
   * refusing them, and asks only that the picker can still tell them apart.
   */
  it('lets two children share a name as long as they do not share a picture', async () => {
    await addChild('Sam', 'owl');
    await addChild('Sam', 'fox');

    const listed = await request(harness.app)
      .get('/api/v1/parent/children')
      .set('authorization', `Bearer ${PARENT_TOKEN}`)
      .expect(200);
    expect(parseEnvelope(childListResponseSchema, listed).children).toHaveLength(2);

    const clash = await asParent('/api/v1/parent/children').send({
      displayName: 'sam',
      grade: '2',
      avatar: 'owl',
    });
    expect(clash.status).toBe(409);
  });

  /** master-plan.md §12: nothing identifying about the adult reaches a child's device. */
  it('never puts the parent address in anything a child route answers', async () => {
    const childId = await addChild();
    await setPin(childId, '4321');
    const cookie = await signIn(childId, '4321');

    const bodies = await Promise.all([
      request(harness.app).post('/api/v1/student/arrival').set('Cookie', cookie).send({}),
      request(harness.app).post('/api/v1/auth/child/refresh').set('Cookie', cookie),
      asParent('/api/v1/auth/child/login').send({ childId, pin: '4321' }),
    ]);

    for (const response of bodies) {
      expect(response.text).not.toContain(PARENT_EMAIL);
    }
  });

  it('locks a child out after five wrong PINs, hashed the way production hashes them', async () => {
    const childId = await addChild();
    await setPin(childId, '4321');

    let last = await asParent('/api/v1/auth/child/login').send({ childId, pin: '0000' });
    for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt += 1) {
      last = await asParent('/api/v1/auth/child/login').send({ childId, pin: '0000' });
    }

    expect(last.status).toBe(423);
    expect(parseError(last).message).toBe('Ask a grown-up for help.');
  }, 30_000);

  /** P2H-12: thirty minutes with nobody in it ends the cookie and the lesson behind it. */
  it('ends the tutor session behind a cookie nobody came back to', async () => {
    const childId = await addChild();
    await setPin(childId, '4321');
    const cookie = await signIn(childId, '4321');
    const session = await harness.sessions.create({
      studentId: childId,
      subject: 'math',
      grade: '4',
      band: 'middle',
    });

    harness.advance(CHILD_SESSION_IDLE_MS + 60_000);
    await expect(harness.sweep()).resolves.toBe(1);

    await expect(harness.sessions.findById(session.id)).resolves.toMatchObject({
      endReason: 'timeout',
    });
    const kinds = (await harness.events.list(session.id)).map((event) => event.kind);
    expect(kinds).toEqual(['PAUSE', 'LEAVE']);
    await request(harness.app)
      .post('/api/v1/student/arrival')
      .set('Cookie', cookie)
      .send({})
      .expect(401);
  });
});
