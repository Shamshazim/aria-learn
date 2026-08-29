import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION, sessionIdSchema } from '@aria/shared';

import { createApp } from '@/app';
import { loadConfig } from '@/config';
import { createArrivalController } from '@/controllers/arrival.controller';
import { createSessionControllers } from '@/controllers/session.controller';
import { ForbiddenError } from '@/errors';
import { fixedClock } from '@/lib/clock';
import { sequentialIds } from '@/lib/ids';
import { createLogger } from '@/lib/logger';
import { createMoveFactory } from '@/services/moves/move-factory';
import type { TutorSessionRecord } from '@/types/session';

import type { RequestHandler } from 'express';

const NOW = new Date('2026-08-24T20:00:00.000Z');
const STUDENT_ID = '00000000-0000-4000-8000-000000000101';
const SESSION_ID = sessionIdSchema.parse('00000000-0000-4000-8000-000000000102');
const CONFIG = loadConfig(
  {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: 'postgresql://aria:aria@localhost:5432/aria_test',
  },
  'test',
);

describe('Phase 1 student HTTP surface', () => {
  it('returns parsed arrival, create, current, turn and end envelopes', async () => {
    const app = buildApp();
    const arrival = await request(app).post('/api/v1/student/arrival').send({});
    expect(arrival.status).toBe(200);
    expect(arrival.body).toMatchObject({
      data: { moves: [{ kind: 'WELCOME' }, { kind: 'CHECK_IN' }] },
    });

    const created = await request(app)
      .post('/api/v1/student/session')
      .send({ subject: 'math', grade: '4', fromRecommendation: false });
    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({ data: { session: { sessionId: SESSION_ID } } });

    const current = await request(app).get('/api/v1/student/session/current');
    expect(current.status).toBe(200);
    expect(current.body).toMatchObject({ data: { lastAppliedSeq: 1 } });

    const turn = await request(app)
      .post('/api/v1/student/session/turn')
      .send({
        protocolVersion: PROTOCOL_VERSION,
        sessionId: SESSION_ID,
        event: {
          id: 'event-1',
          at: NOW.toISOString(),
          protocolVersion: PROTOCOL_VERSION,
          sessionId: SESSION_ID,
          kind: 'CONFUSED',
        },
      });
    expect(turn.status).toBe(200);
    expect(turn.body).toMatchObject({ data: { inResponseTo: 'event-1' } });

    const ended = await request(app)
      .post('/api/v1/student/session/end')
      .send({ sessionId: SESSION_ID, reason: 'complete' });
    expect(ended.status).toBe(200);
    expect(ended.body).toMatchObject({ data: { reason: 'complete' } });
  });

  it('rejects invalid input and an unauthorized student', async () => {
    expect(
      (await request(buildApp()).post('/api/v1/student/session').send({ grade: '4' })).status,
    ).toBe(400);
    expect((await request(buildApp(true)).get('/api/v1/student/session/current')).status).toBe(403);
  });
});

function buildApp(deny = false) {
  const clock = fixedClock(NOW);
  const moves = createMoveFactory({ ids: sequentialIds('move'), clock, sessionId: SESSION_ID });
  const welcome = createMoveFactory({ ids: sequentialIds('arrival'), clock });
  const ask = moves.make({
    kind: 'ASK',
    itemId: 'item-1',
    speech: { text: 'What is four plus three?' },
    display: [],
    expects: 'text',
  });
  const session = sessionRecord();
  const authorize: RequestHandler = deny
    ? (_request, _response, next) => {
        next(new ForbiddenError('student access denied'));
      }
    : (request_, _response, next) => {
        Object.assign(request_, { studentId: STUDENT_ID });
        next();
      };
  const arrival = createArrivalController({
    arrive: () =>
      Promise.resolve({
        arrivalId: '00000000-0000-4000-8000-000000000001',
        recommendedSubject: null,
        student: { grade: '4', band: 'middle' },
        classes: [{ subjectId: 'mathematics', name: 'Mathematics', grade: '4' }],
        moves: [
          welcome.make({
            kind: 'WELCOME',
            basedOn: [],
            speech: { text: 'Hi Sam.' },
            display: [],
            expects: 'none',
          }),
          welcome.make({
            kind: 'CHECK_IN',
            about: 'difficulty',
            speech: { text: 'Ready?' },
            display: [],
            expects: 'choice',
          }),
        ],
      }),
  });
  const sessions = createSessionControllers({
    sessions: {
      createOrResume: () => Promise.resolve({ session, moves: [ask], resumed: false }),
      current: () =>
        Promise.resolve({ session, moves: [ask], lastAppliedSeq: 1, lastActivityAt: NOW }),
    },
    turn: (_studentId, input) =>
      Promise.resolve({
        protocolVersion: PROTOCOL_VERSION,
        sessionId: SESSION_ID,
        inResponseTo: input.event.id,
        at: NOW.toISOString(),
        moves: [ask],
      }),
    end: () => Promise.resolve({ ...session, endedAt: NOW, endReason: 'complete' }),
  });
  return createApp({
    config: CONFIG,
    logger: createLogger({ level: 'silent' }),
    clock,
    ids: sequentialIds('request'),
    student: { authorize, arrival, sessions },
  });
}

function sessionRecord(): TutorSessionRecord {
  return {
    id: SESSION_ID,
    studentId: STUDENT_ID,
    subject: 'math',
    grade: '4',
    band: 'middle',
    startedAt: NOW,
    endedAt: null,
    endReason: null,
    plan: {},
    summary: null,
  };
}
