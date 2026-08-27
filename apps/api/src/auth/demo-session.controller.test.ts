import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { childSessionResponseSchema } from '@aria/shared';

import { createApp } from '@/app';
import { createDemoAuthControllers } from '@/auth/demo-session.controller';
import { loadConfig } from '@/config';
import { fixedClock } from '@/lib/clock';
import { sequentialIds } from '@/lib/ids';
import { createLogger } from '@/lib/logger';
import { fakeStudents, NOW, SAM_ID } from '@/routes/__fixtures__/identity-app.fixture';
import { parseEnvelope } from '@/testing/envelope';

import type { Express } from 'express';

/**
 * The development bypass. It exists so that a developer with no Supabase project can still
 * open the app; what is worth proving is that it hands back a usable session and that it
 * refuses everything else, so nobody mistakes it for a login.
 */
const CONFIG = loadConfig(
  {
    NODE_ENV: 'development',
    LOG_LEVEL: 'silent',
    DATABASE_URL: 'postgresql://aria:aria@localhost:5432/aria_test',
    ALLOW_DEMO_STUDENT: 'true',
    ARIA_DEMO_STUDENT_ID: SAM_ID,
  },
  'test',
);

function buildApp(): Express {
  return createApp({
    config: CONFIG,
    logger: createLogger({ level: 'silent' }),
    clock: fixedClock(NOW),
    ids: sequentialIds('req'),
    identity: {
      auth: {
        parentAuth: (_request, response) => {
          response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found.' } });
        },
        controller: createDemoAuthControllers({
          students: fakeStudents(),
          demoStudentId: SAM_ID,
          clock: fixedClock(NOW),
        }),
      },
    },
  });
}

describe('the development bypass', () => {
  it('answers "yes, the demo child" so the app can open at all', async () => {
    const response = await request(buildApp()).post('/api/v1/auth/child/refresh');

    expect(response.status).toBe(200);
    expect(parseEnvelope(childSessionResponseSchema, response).child).toMatchObject({
      id: SAM_ID,
      firstName: 'Sam',
      loginMethod: 'family-device',
    });
  });

  /** Nobody signs in or out of a session that was never issued. */
  it('refuses login and logout rather than pretending to be one', async () => {
    const app = buildApp();

    await request(app)
      .post('/api/v1/auth/child/login')
      .send({ childId: SAM_ID, pin: '4321' })
      .expect(404);
    await request(app).post('/api/v1/auth/child/logout').expect(404);
  });

  it('issues no cookie, because there is no session to carry', async () => {
    const response = await request(buildApp()).post('/api/v1/auth/child/refresh');

    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('mounts no parent routes: there is no adult to authenticate', async () => {
    await request(buildApp()).get('/api/v1/parent/children').expect(404);
  });
});
