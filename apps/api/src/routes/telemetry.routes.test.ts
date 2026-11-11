import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { sessionIdSchema } from '@aria/shared';

import { createApp } from '@/app';
import { loadConfig } from '@/config';
import { createTelemetryController } from '@/controllers/telemetry.controller';
import { ForbiddenError } from '@/errors';
import { fixedClock } from '@/lib/clock';
import { sequentialIds } from '@/lib/ids';
import { createLogger } from '@/lib/logger';
import { createClientTimingObserver } from '@/observability/client-metrics';
import { createMetrics, type Metrics } from '@/observability/metrics';
import { createTurnTimingService } from '@/services/telemetry/turn-timing.service';
import type { TutorSessionRecord } from '@/types/session';

import type { RequestHandler } from 'express';

const NOW = new Date('2026-09-30T09:00:00.000Z');
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

describe('POST /api/v1/telemetry/turn', () => {
  it('accepts a report and records it against the session band', async () => {
    const metrics = createMetrics();

    const response = await request(buildApp({ metrics }))
      .post('/api/v1/telemetry/turn')
      .send({
        sessionId: SESSION_ID,
        timings: [
          { kind: 'audible_welcome', ms: 780 },
          { kind: 'interrupt_silence', ms: 190 },
        ],
      });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({ data: { recorded: 2, dropped: 0 } });
    expect(metrics.snapshot().histograms).toMatchObject({
      'audible_welcome_ms{band=middle}': { count: 1, sum: 780 },
      'interrupt_silence_ms{band=middle}': { count: 1, sum: 190 },
    });
  });

  it('rejects an unknown field rather than ignoring it', async () => {
    const response = await request(buildApp())
      .post('/api/v1/telemetry/turn')
      .send({
        sessionId: SESSION_ID,
        timings: [{ kind: 'audible_welcome', ms: 780 }],
        studentName: 'Sam',
      });

    expect(response.status).toBe(400);
  });

  it.each([
    ['a kind nothing measures', { timings: [{ kind: 'how_long_the_child_smiled', ms: 1 }] }],
    ['a negative duration', { timings: [{ kind: 'audible_welcome', ms: -5 }] }],
    ['a duration past the protocol ceiling', { timings: [{ kind: 'audible_welcome', ms: 1e9 }] }],
    ['no timings at all', { timings: [] }],
  ])('refuses %s', async (_name, body) => {
    expect((await request(buildApp()).post('/api/v1/telemetry/turn').send(body)).status).toBe(400);
  });

  it('refuses a child who is not signed in', async () => {
    const response = await request(buildApp({ deny: true }))
      .post('/api/v1/telemetry/turn')
      .send({ sessionId: SESSION_ID, timings: [{ kind: 'audible_welcome', ms: 780 }] });

    expect(response.status).toBe(403);
  });

  /**
   * The route is behind the child gate, so a report with no session still has an actor. This
   * is the class-picker case: `arrival_visible` is measured before a session exists.
   */
  it('accepts a report with no session id', async () => {
    const response = await request(buildApp())
      .post('/api/v1/telemetry/turn')
      .send({ timings: [{ kind: 'arrival_visible', ms: 410 }] });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({ data: { recorded: 1, dropped: 0 } });
  });
});

function buildApp(options: Readonly<{ deny?: boolean; metrics?: Metrics }> = {}) {
  const authorize: RequestHandler =
    options.deny === true
      ? (_request, _response, next) => {
          next(new ForbiddenError('student access denied'));
        }
      : (request_, _response, next) => {
          Object.assign(request_, { studentId: STUDENT_ID });
          next();
        };
  const timings = createTurnTimingService({
    sessions: { findById: () => Promise.resolve(sessionRecord()) },
    students: { requireById: () => Promise.resolve({ band: 'middle', isSynthetic: false }) },
    observe: createClientTimingObserver({ metrics: options.metrics ?? createMetrics() }),
  });
  return createApp({
    config: CONFIG,
    logger: createLogger({ level: 'silent' }),
    clock: fixedClock(NOW),
    ids: sequentialIds('request'),
    telemetry: { authorize, controller: createTelemetryController({ timings }) },
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
