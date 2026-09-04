import { createHash } from 'node:crypto';

import express, { json, type Express } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { sequentialIds } from '@/lib/ids';
import { createLogger } from '@/lib/logger';
import { errorHandler } from '@/middleware/error-handler';
import { idempotent } from '@/middleware/idempotency';
import { requestId } from '@/middleware/request-id';
import { requestLogger } from '@/middleware/request-logger';
import { createFakeIdempotencyRepository } from '@/repositories/__fixtures__/idempotency.fixture';
import type { IdempotencyRepository } from '@/types/idempotency';

/**
 * A request that arrives twice (X-05).
 *
 * The case is ordinary: a child taps "answer", the reply is slow, they tap again. What must
 * not happen is the turn running a second time — so every test here counts how often the
 * handler behind the middleware actually ran.
 */
const KEY = 'a1b2c3d4-tap-once';

describe('idempotent requests', () => {
  it('runs the handler once and replays the first response to a retry', async () => {
    const { app, handler } = buildApp();

    const first = await post(app, KEY, { answer: 7 });
    const second = await post(app, KEY, { answer: 7 });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(second.status).toBe(first.status);
    expect(second.body).toEqual(first.body);
  });

  /** The retry must receive the *first* answer, not a fresh one. */
  it('replays the stored body even when the handler would now answer differently', async () => {
    let reply = 'first';
    const { app } = buildApp(() => ({ reply }));

    const first = await post(app, KEY, { answer: 7 });
    reply = 'second';
    const retry = await post(app, KEY, { answer: 7 });

    expect(first.body).toEqual({ reply: 'first' });
    expect(retry.body).toEqual({ reply: 'first' });
  });

  it('refuses the same key with a different body rather than answering the wrong question', async () => {
    const { app, handler } = buildApp();
    await post(app, KEY, { answer: 7 });

    const changed = await post(app, KEY, { answer: 8 });

    expect(changed.status).toBe(400);
    expect(errorCodeOf(changed.body)).toBe('VALIDATION_FAILED');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  /** Key order is a serialisation detail; a retry that reorders its JSON is still a retry. */
  it('treats the same body with reordered keys as the same request', async () => {
    const { app, handler } = buildApp();

    await post(app, KEY, { a: 1, b: 2 });
    const reordered = await post(app, KEY, { b: 2, a: 1 });

    expect(reordered.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('requires a key, so no client can quietly opt out of the protection', async () => {
    const { app, handler } = buildApp();

    const response = await request(app).post('/thing').send({ answer: 7 });

    expect(response.status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
  });

  it('rejects a key too short to be unique', async () => {
    const { app } = buildApp();

    expect((await post(app, 'abc', { answer: 7 })).status).toBe(400);
  });

  /** Two children choosing the same key is not a hypothetical — clients pick these. */
  it('scopes a key to its actor, so two children cannot collide', async () => {
    const repository = createFakeIdempotencyRepository();
    const childA = buildApp(undefined, { repository, studentId: 'child-a' });
    const childB = buildApp(undefined, { repository, studentId: 'child-b' });

    await post(childA.app, KEY, { answer: 7 });
    const other = await post(childB.app, KEY, { answer: 7 });

    expect(other.status).toBe(200);
    expect(childB.handler).toHaveBeenCalledTimes(1);
  });

  /**
   * A failed attempt stores nothing. A client retrying a request that 500ed is doing the right
   * thing, and must not be handed the failure back forever.
   */
  it('lets a retry run again when the first attempt failed', async () => {
    let fail = true;
    const { app, handler } = buildApp((response) => {
      if (fail) {
        response.status(500);
        return { error: 'boom' };
      }
      return { reply: 'recovered' };
    });

    await post(app, KEY, { answer: 7 });
    fail = false;
    const retry = await post(app, KEY, { answer: 7 });

    expect(retry.status).toBe(200);
    expect(retry.body).toEqual({ reply: 'recovered' });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  /** A second tap arriving while the first is still running has nothing to replay yet. */
  it('refuses a duplicate that arrives while the first is still in flight', async () => {
    const repository = createFakeIdempotencyRepository();
    const { app, handler } = buildApp(undefined, { repository });
    await repository.claim(
      {
        key: KEY,
        actorClass: 'student',
        actorId: 'child-a',
        route: 'POST /thing',
      },
      // The hash of `{"answer":7}` as the middleware computes it.
      hashOfAnswerSeven(),
      60,
    );

    const response = await post(app, KEY, { answer: 7 });

    expect(response.status).toBe(409);
    expect(handler).not.toHaveBeenCalled();
  });
});

/** Computed the way the middleware does, so the seeded row looks like a real first attempt. */
function hashOfAnswerSeven(): string {
  return createHash('sha256').update('{"answer":7}').digest('hex');
}

/** Parsed rather than asserted, so a change in the error envelope fails here loudly. */
function errorCodeOf(body: unknown): string {
  return z.object({ error: z.object({ code: z.string() }) }).parse(body).error.code;
}

async function post(
  app: Express,
  key: string,
  body: Record<string, unknown>,
): Promise<request.Response> {
  return request(app).post('/thing').set('Idempotency-Key', key).send(body);
}

function buildApp(
  reply: (response: express.Response) => unknown = () => ({ ok: true }),
  options: Readonly<{ repository?: IdempotencyRepository; studentId?: string }> = {},
) {
  const repository = options.repository ?? createFakeIdempotencyRepository();
  const handler = vi.fn(reply);
  const app = express();

  app.use(json());
  app.use(requestId(sequentialIds('request')));
  app.use(requestLogger(createLogger({ level: 'silent' })));
  app.use((request_, _response, next) => {
    Object.assign(request_, { studentId: options.studentId ?? 'child-a' });
    next();
  });
  app.post('/thing', idempotent(repository), (_request, response) => {
    response.json(handler(response));
  });
  app.use(errorHandler());

  return { app, handler, repository };
}
