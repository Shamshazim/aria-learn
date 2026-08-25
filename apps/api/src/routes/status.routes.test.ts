import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createStatusController } from '@/controllers/status.controller';
import { operatorOnly } from '@/middleware/operator-only';
import { createStatusRouter } from '@/routes/status.routes';

const status = {
  endpoints: [],
  spend: { totalTodayUsd: 0, studentsAtCap: 0 },
};

function app() {
  const server = express();
  server.use(
    createStatusRouter(
      createStatusController({ getStatus: () => Promise.resolve(status) }),
      operatorOnly('a-secure-operator-token-that-is-long-enough'),
    ),
  );
  return server;
}

describe('GET /status', () => {
  it('rejects a request without the operator bearer token', async () => {
    expect((await request(app()).get('/status')).status).toBe(404);
  });

  it('returns status to an operator', async () => {
    const response = await request(app())
      .get('/status')
      .set('authorization', 'Bearer a-secure-operator-token-that-is-long-enough');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: status });
  });
});
