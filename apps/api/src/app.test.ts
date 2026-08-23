import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '@/app';
import { loadConfig } from '@/config';
import { AppError, ERROR_CODES } from '@/errors';
import { fixedClock } from '@/lib/clock';
import { sequentialIds } from '@/lib/ids';
import { createLogger } from '@/lib/logger';
import { asyncHandler } from '@/middleware/async-handler';
import { errorHandler } from '@/middleware/error-handler';
import { REQUEST_ID_HEADER, requestId } from '@/middleware/request-id';
import { requestLogger } from '@/middleware/request-logger';

import type { Express } from 'express';

/**
 * The integration tests for the shell. They cover the three paths every later router
 * inherits: a successful resource, an unknown route, and an unhandled rejection.
 */
const config = loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent' }, '9.9.9');

function buildApp(): Express {
  return createApp({
    config,
    logger: createLogger({ level: 'silent' }),
    clock: fixedClock(new Date('2026-08-22T10:00:00Z')),
    ids: sequentialIds('req'),
  });
}

describe('GET /api/v1/health', () => {
  it('returns 200 with status, version and uptime', async () => {
    const response = await request(buildApp()).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: { status: 'ok', version: '9.9.9', uptimeSeconds: 0 },
    });
  });

  it('echoes a correlation id on the response', async () => {
    const response = await request(buildApp()).get('/api/v1/health');

    expect(response.headers[REQUEST_ID_HEADER]).toBe('req-1');
  });

  it('joins an inbound trace when the caller supplies a usable id', async () => {
    const response = await request(buildApp())
      .get('/api/v1/health')
      .set(REQUEST_ID_HEADER, 'trace-abc');

    expect(response.headers[REQUEST_ID_HEADER]).toBe('trace-abc');
  });

  it('ignores an inbound id that is not safe to echo', async () => {
    const response = await request(buildApp())
      .get('/api/v1/health')
      .set(REQUEST_ID_HEADER, 'not a safe id');

    expect(response.headers[REQUEST_ID_HEADER]).toBe('req-1');
  });

  it('does not advertise the framework', async () => {
    const response = await request(buildApp()).get('/api/v1/health');

    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});

describe('an unknown route', () => {
  it('returns the standard 404 body', async () => {
    const response = await request(buildApp()).get('/api/v1/nothing-here');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { code: ERROR_CODES.NOT_FOUND, message: 'Not found.', requestId: 'req-1' },
    });
  });

  it('returns the same shape outside the api prefix', async () => {
    const response = await request(buildApp()).post('/');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ error: { code: ERROR_CODES.NOT_FOUND } });
  });
});

describe('an unhandled rejection in a controller', () => {
  /** The shell under test, with one route that throws, to exercise the error path. */
  function appThatThrows(error: unknown): Express {
    const app = express();
    app.use(requestId(sequentialIds('req')));
    // The real logging middleware, so `req.log` is attached the way it is in production
    // rather than by a hand-written stand-in that could drift from it.
    app.use(requestLogger(createLogger({ level: 'silent' })));
    app.get(
      '/boom',
      asyncHandler(async () => {
        await Promise.resolve();
        throw error;
      }),
    );
    app.use(errorHandler());
    return app;
  }

  it('returns the standard 500 body and leaks no detail', async () => {
    const secret = new Error('connection string postgres://user:pw@host/db');
    const response = await request(appThatThrows(secret)).get('/boom');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: { code: ERROR_CODES.INTERNAL, message: 'Something went wrong.', requestId: 'req-1' },
    });

    const serialised = JSON.stringify(response.body);
    expect(serialised).not.toContain('postgres://');
    expect(serialised).not.toContain('stack');
  });

  it('maps an AppError to its own status and safe message', async () => {
    const known = new AppError(ERROR_CODES.SERVICE_UNAVAILABLE, 503, 'Temporarily unavailable.', {
      logMessage: 'upstream pool exhausted',
    });
    const response = await request(appThatThrows(known)).get('/boom');

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ error: { message: 'Temporarily unavailable.' } });
    expect(JSON.stringify(response.body)).not.toContain('pool exhausted');
  });

  it('reports a non-Error rejection as a generic 500', async () => {
    const response = await request(appThatThrows('a bare string')).get('/boom');

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({ error: { code: ERROR_CODES.INTERNAL } });
  });
});
