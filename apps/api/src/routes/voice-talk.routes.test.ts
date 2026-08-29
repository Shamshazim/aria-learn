import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '@/app';
import { loadConfig } from '@/config';
import { createVoiceTalkControllers } from '@/controllers/voice-talk.controller';
import { fixedClock } from '@/lib/clock';
import { sequentialIds } from '@/lib/ids';
import { createLogger } from '@/lib/logger';
import { workerOnly } from '@/middleware/worker-only';

import type { RequestHandler } from 'express';

const SESSION_ID = '00000000-0000-4000-8000-000000000103';
const WORKER_TOKEN = 'w'.repeat(32);
const NOW = new Date('2026-08-28T20:00:00.000Z');
const CONFIG = loadConfig(
  {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: 'postgresql://aria:aria@localhost:5432/aria_test',
  },
  'test',
);

const unused: RequestHandler = (_request, response) => {
  response.status(501).end();
};

function talkControllers() {
  return createVoiceTalkControllers({
    brief: (sessionId, connectionEpoch) =>
      Promise.resolve({
        connectionEpoch,
        student: { firstName: 'Sam', grade: '4' as const, band: 'middle' as const },
        subject: 'mathematics',
        skill: {
          code: 'MATH.G4.U01.L02.T03',
          name: 'Rounding',
          unit: 'Place value',
          lesson: 'Rounding',
          objectives: ['Round to the nearest ten'],
        },
        note: null,
        openQuestion: { id: `${sessionId}-ask`, prompt: 'Round 468.', answerKey: '470', options: [] },
        memory: [],
        minutesLeft: 12,
      }),
    events: {
      heard: (_sessionId, _epoch, text) =>
        Promise.resolve({ crisis: text.includes('hurt myself') ? { say: 'I am here.' } : null }),
      spoken: (_sessionId, _epoch, text) =>
        Promise.resolve({ verdict: text.includes('weapon') ? ('unsafe' as const) : ('ok' as const) }),
    },
  });
}

function buildApp() {
  const controller = {
    realtime: unused,
    workerTurn: unused,
    workerMetric: unused,
    grantConsent: unused,
    withdrawConsent: unused,
  };
  return createApp({
    config: CONFIG,
    logger: createLogger({ level: 'silent' }),
    clock: fixedClock(NOW),
    ids: sequentialIds('request'),
    voice: {
      student: { authorize: unused, controller },
      worker: {
        authorize: workerOnly(WORKER_TOKEN),
        controller,
        bridges: { library: unused, audio: unused },
        talk: talkControllers(),
      },
      admin: { authorize: unused, controller },
    },
  });
}

describe('the worker endpoints of a session where Aria talks', () => {
  const auth = { authorization: `Bearer ${WORKER_TOKEN}` };

  it('hands the worker the brief for the current connection epoch', async () => {
    const response = await request(buildApp())
      .get(`/api/v1/internal/voice/session/${SESSION_ID}/brief?connectionEpoch=2`)
      .set(auth);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      data: {
        connectionEpoch: 2,
        student: { firstName: 'Sam', grade: '4' },
        skill: { name: 'Rounding' },
        openQuestion: { answerKey: '470' },
      },
    });
  });

  it('records what the child said and returns the crisis line when there is one', async () => {
    const app = buildApp();
    const calm = await request(app)
      .post(`/api/v1/internal/voice/session/${SESSION_ID}/heard`)
      .set(auth)
      .send({ connectionEpoch: 2, text: 'four hundred seventy' });
    const crisis = await request(app)
      .post(`/api/v1/internal/voice/session/${SESSION_ID}/heard`)
      .set(auth)
      .send({ connectionEpoch: 2, text: 'I want to hurt myself' });

    expect(calm.body).toEqual({ data: { crisis: null } });
    expect(crisis.body).toEqual({ data: { crisis: { say: 'I am here.' } } });
  });

  it('records what Aria said and flags unsafe speech', async () => {
    const response = await request(buildApp())
      .post(`/api/v1/internal/voice/session/${SESSION_ID}/spoken`)
      .set(auth)
      .send({ connectionEpoch: 2, text: 'A weapon is not a toy.' });

    expect(response.body).toEqual({ data: { verdict: 'unsafe' } });
  });

  it('refuses the talk endpoints without the worker token', async () => {
    const response = await request(buildApp()).post(
      `/api/v1/internal/voice/session/${SESSION_ID}/heard`,
    );
    expect(response.status).toBe(403);
  });
});
