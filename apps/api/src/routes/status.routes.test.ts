import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createMetricsController } from '@/controllers/metrics.controller';
import { createStatusController } from '@/controllers/status.controller';
import { operatorOnly } from '@/middleware/operator-only';
import { createMetrics } from '@/observability/metrics';
import { createStatusRouter } from '@/routes/status.routes';
import type { StatusResponse } from '@/services/status.service';

const TOKEN = 'a-secure-operator-token-that-is-long-enough';

const status: StatusResponse = {
  endpoints: [],
  spend: { totalTodayUsd: 0, studentsAtCap: 0 },
  slos: { total: 2, instrumented: 1, gaps: [{ id: 'a', title: 'A', blockedBy: 'no metric' }] },
};

function app(metrics?: ReturnType<typeof createMetrics>) {
  const server = express();
  server.use(
    createStatusRouter(
      createStatusController({ getStatus: () => Promise.resolve(status) }),
      operatorOnly(TOKEN),
      metrics === undefined ? undefined : createMetricsController({ metrics }),
    ),
  );
  return server;
}

describe('GET /status', () => {
  it('rejects a request without the operator bearer token', async () => {
    expect((await request(app()).get('/status')).status).toBe(404);
  });

  it('returns status to an operator', async () => {
    const response = await request(app()).get('/status').set('authorization', `Bearer ${TOKEN}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: status });
  });
});

/**
 * X-04: the scrape endpoint sits behind the same token, and speaks the scraper's format
 * rather than this API's envelope.
 */
describe('GET /metrics', () => {
  it('is not mounted where no metric store was supplied', async () => {
    expect(
      (await request(app()).get('/metrics').set('authorization', `Bearer ${TOKEN}`)).status,
    ).toBe(404);
  });

  it('refuses an unauthenticated scrape the way /status does', async () => {
    expect((await request(app(createMetrics())).get('/metrics')).status).toBe(404);
  });

  it('serves the exposition as text, with no JSON envelope around it', async () => {
    const metrics = createMetrics();
    metrics.increment('turns_total', { band: 'middle' });

    const response = await request(app(metrics))
      .get('/metrics')
      .set('authorization', `Bearer ${TOKEN}`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.text).toBe('# TYPE turns_total counter\nturns_total{band="middle"} 1\n');
  });
});
