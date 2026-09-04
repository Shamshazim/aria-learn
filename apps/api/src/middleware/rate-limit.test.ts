import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createApp } from '@/app';
import { loadConfig } from '@/config';
import { policyFor } from '@/config/rate-limit';
import { createArrivalController } from '@/controllers/arrival.controller';
import type { SessionControllers } from '@/controllers/session.controller';
import { fixedClock } from '@/lib/clock';
import { sequentialIds } from '@/lib/ids';
import { createLogger } from '@/lib/logger';
import { createFakeIdempotencyRepository } from '@/repositories/__fixtures__/idempotency.fixture';
import { createMoveFactory } from '@/services/moves/move-factory';
import { createMemoryRateLimitStore } from '@/services/rate-limit/memory-store';
import type { IdempotencyRepository } from '@/types/idempotency';
import type { RateLimitStore } from '@/types/rate-limit';

import type { Express, RequestHandler } from 'express';

/**
 * The limit as a child's device would meet it (X-05).
 *
 * The unit tests prove the arithmetic; this proves the wiring — that a spent bucket becomes a
 * 429 with a `Retry-After`, that the body is the same shape every other error uses, and that
 * one child's spending cannot refuse another.
 */
const NOW = new Date('2026-09-03T10:00:00.000Z');
const STUDENT_A = '00000000-0000-4000-8000-000000000101';
const STUDENT_B = '00000000-0000-4000-8000-000000000102';
const CONFIG = loadConfig(
  {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: 'postgresql://aria:aria@localhost:5432/aria_test',
  },
  'test',
);
const ARRIVAL_BUDGET = policyFor('student', 'session').burst;

describe('rate limiting a student route', () => {
  it('serves the whole burst, then refuses with 429 and a Retry-After', async () => {
    const app = buildApp();

    const allowed = await arriveTimes(app, ARRIVAL_BUDGET);
    expect(allowed.every((status) => status === 200)).toBe(true);

    const refused = await request(app).post('/api/v1/student/arrival').send({});
    expect(refused.status).toBe(429);
    expect(Number(refused.headers['retry-after'])).toBeGreaterThanOrEqual(1);
  });

  /**
   * The child UI branches on the code to show the P0-25 calm screen. The message is the one a
   * child could read, and says nothing about limits, numbers or blame.
   */
  it('answers in the one error shape, with a code the UI can branch on', async () => {
    const app = buildApp();
    await arriveTimes(app, ARRIVAL_BUDGET);

    const refused = await request(app).post('/api/v1/student/arrival').send({});

    expect(refused.body).toMatchObject({
      error: { code: 'RATE_LIMITED', message: 'Let us slow down for a moment.' },
    });
    // The code is for the UI to branch on; the message is the only part a child could read,
    // and it must not mention limits, numbers or anything that reads as blame.
    const envelope = errorEnvelopeOf(refused.body);
    expect(envelope.message).not.toMatch(/429|limit|bucket|too many/iu);
    expect(envelope.requestId).not.toHaveLength(0);
  });

  it('bills each child their own budget', async () => {
    const store = createMemoryRateLimitStore();
    const appA = buildApp({ store, studentId: STUDENT_A });
    const appB = buildApp({ store, studentId: STUDENT_B });
    await arriveTimes(appA, ARRIVAL_BUDGET);

    expect((await request(appA).post('/api/v1/student/arrival').send({})).status).toBe(429);
    expect((await request(appB).post('/api/v1/student/arrival').send({})).status).toBe(200);
  });

  /** A child reading their session must not be refused because they answered a lot. */
  it('keeps the read budget separate from the session budget', async () => {
    const app = buildApp();
    await arriveTimes(app, ARRIVAL_BUDGET + 1);

    expect((await request(app).get('/api/v1/student/session/current')).status).not.toBe(429);
  });

  /**
   * A limiter that cannot reach its store must not take the route down with it. The traffic it
   * exists to bound is expensive; refusing every child because the store blinked is worse.
   */
  it('fails open when the store is unreachable', async () => {
    const broken: RateLimitStore = {
      consume: () => Promise.reject(new Error('store unreachable')),
    };

    expect(
      (
        await request(buildApp({ store: broken }))
          .post('/api/v1/student/arrival')
          .send({})
      ).status,
    ).toBe(200);
  });

  /**
   * The wiring, on a real route: with a store configured, a repeated `POST /student/session`
   * is answered from the record of the first rather than run again. `idempotency.test.ts`
   * proves the middleware; this proves the router actually mounts it.
   */
  it('replays a repeated session create rather than starting a second one', async () => {
    let created = 0;
    const app = buildApp({
      idempotency: createFakeIdempotencyRepository(),
      onCreateSession: () => {
        created += 1;
        return { created };
      },
    });
    const body = { subject: 'math', grade: '4', fromRecommendation: false };

    const first = await request(app)
      .post('/api/v1/student/session')
      .set('Idempotency-Key', 'tap-once-please')
      .send(body);
    const retry = await request(app)
      .post('/api/v1/student/session')
      .set('Idempotency-Key', 'tap-once-please')
      .send(body);

    expect(created).toBe(1);
    expect(retry.body).toEqual(first.body);
  });

  /** Health is what a load balancer probes; an instance that limits it takes itself out. */
  it('never limits the health probe', async () => {
    const app = buildApp();
    const statuses: number[] = [];

    for (let i = 0; i < ARRIVAL_BUDGET + 5; i += 1) {
      statuses.push((await request(app).get('/api/v1/health')).status);
    }

    expect(statuses.every((status) => status === 200)).toBe(true);
  });
});

async function arriveTimes(app: Express, times: number): Promise<number[]> {
  const statuses: number[] = [];
  for (let i = 0; i < times; i += 1) {
    statuses.push((await request(app).post('/api/v1/student/arrival').send({})).status);
  }
  return statuses;
}

function buildApp(
  options: Readonly<{
    store?: RateLimitStore;
    studentId?: string;
    idempotency?: IdempotencyRepository;
    onCreateSession?: () => unknown;
  }> = {},
): Express {
  const clock = fixedClock(NOW);
  const welcome = createMoveFactory({ ids: sequentialIds('arrival'), clock });
  const studentId = options.studentId ?? STUDENT_A;
  const authorize: RequestHandler = (request_, _response, next) => {
    Object.assign(request_, { studentId });
    next();
  };

  return createApp({
    config: CONFIG,
    logger: createLogger({ level: 'silent' }),
    clock,
    ids: sequentialIds('request'),
    rateLimitStore: options.store ?? createMemoryRateLimitStore(),
    ...(options.idempotency === undefined ? {} : { idempotency: options.idempotency }),
    student: {
      authorize,
      arrival: createArrivalController({
        arrive: () =>
          Promise.resolve({
            arrivalId: '00000000-0000-4000-8000-000000000001',
            recommendedSubject: null,
            student: { grade: '4', band: 'middle' },
            classes: [],
            moves: [
              welcome.make({
                kind: 'WELCOME',
                basedOn: [],
                speech: { text: 'Hi.' },
                display: [],
                expects: 'none',
              }),
            ],
          }),
      }),
      sessions: sessionControllerStub(options.onCreateSession),
    },
  });
}

/** Parsed rather than asserted, so a change in the error envelope fails here loudly. */
function errorEnvelopeOf(body: unknown): { message: string; requestId: string } {
  return z.object({ error: z.object({ message: z.string(), requestId: z.string() }) }).parse(body)
    .error;
}

/**
 * The routes this test does not exercise still have to exist for the router to mount. Typed as
 * the real `SessionControllers` rather than asserted into shape — an assertion here would hide
 * the day the controller signature changes.
 */
function sessionControllerStub(onCreate?: () => unknown): SessionControllers {
  const unused: RequestHandler = () => {
    throw new Error('not exercised by this test');
  };
  return {
    create:
      onCreate === undefined
        ? unused
        : (_request, response) => {
            response.json({ data: onCreate() });
          },
    current: (_request, response) => {
      response.json({ data: { lastAppliedSeq: 0 } });
    },
    end: unused,
    turn: unused,
  };
}
