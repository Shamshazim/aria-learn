import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION, sessionIdSchema } from '@aria/shared';

import { createApp } from '@/app';
import { loadConfig } from '@/config';
import { createVoiceBridgeControllers } from '@/controllers/voice-bridge.controller';
import { createVoiceControllers } from '@/controllers/voice.controller';
import { ForbiddenError } from '@/errors';
import { fixedClock } from '@/lib/clock';
import { sequentialIds } from '@/lib/ids';
import { createLogger } from '@/lib/logger';
import { operatorOnly } from '@/middleware/operator-only';
import { workerOnly } from '@/middleware/worker-only';

import type { RequestHandler } from 'express';

const STUDENT_ID = '00000000-0000-4000-8000-000000000101';
const PARENT_ID = '00000000-0000-4000-8000-000000000102';
const SESSION_ID = sessionIdSchema.parse('00000000-0000-4000-8000-000000000103');
const WORKER_TOKEN = 'w'.repeat(32);
const OPERATOR_TOKEN = 'o'.repeat(32);
const NOW = new Date('2026-08-24T20:00:00.000Z');
const CONFIG = loadConfig(
  {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: 'postgresql://aria:aria@localhost:5432/aria_test',
  },
  'test',
);

describe('Phase 2 voice HTTP surface', () => {
  it('returns short-lived credentials to the authorized student', async () => {
    const response = await request(buildApp()).post(
      `/api/v1/student/session/${SESSION_ID}/realtime`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      data: { room: `aria_${SESSION_ID}`, connectionEpoch: 2, processors: ['media', 'stt', 'tts'] },
    });
  });

  it('serves the worker its own band library and the clip bytes behind it', async () => {
    const library = await request(buildApp())
      .get('/api/v1/internal/voice/bridges?band=middle&voice=voice-middle')
      .set('authorization', `Bearer ${WORKER_TOKEN}`);

    expect(library.status).toBe(200);
    expect(library.body).toMatchObject({
      data: { band: 'middle', clips: [{ bucket: 'thinking' }] },
    });

    const audio = await request(buildApp())
      .get(`/api/v1/internal/voice/bridges/${BRIDGE_ASSET_ID}/audio`)
      .set('authorization', `Bearer ${WORKER_TOKEN}`);

    expect(audio.status).toBe(200);
    expect(audio.headers['content-type']).toContain('application/octet-stream');
  });

  it('rejects a bridge request without a worker token, a bad band or a bad asset id', async () => {
    expect(
      (await request(buildApp()).get('/api/v1/internal/voice/bridges?band=middle&voice=v')).status,
    ).toBe(403);
    expect(
      (await request(buildApp()).get(`/api/v1/internal/voice/bridges/${BRIDGE_ASSET_ID}/audio`))
        .status,
    ).toBe(403);
    expect(
      (
        await request(buildApp())
          .get('/api/v1/internal/voice/bridges?band=not-a-band&voice=v')
          .set('authorization', `Bearer ${WORKER_TOKEN}`)
      ).status,
    ).toBe(400);
    expect(
      (
        await request(buildApp())
          .get('/api/v1/internal/voice/bridges/not-a-uuid/audio')
          .set('authorization', `Bearer ${WORKER_TOKEN}`)
      ).status,
    ).toBe(400);
  });

  it('validates ids and rejects unauthorized student, worker and operator calls', async () => {
    expect(
      (await request(buildApp()).post('/api/v1/student/session/not-an-id/realtime')).status,
    ).toBe(400);
    expect(
      (await request(buildApp(true)).post(`/api/v1/student/session/${SESSION_ID}/realtime`)).status,
    ).toBe(403);
    expect(
      (
        await request(buildApp())
          .post(`/api/v1/internal/voice/session/${SESSION_ID}/turn`)
          .send(workerTurnBody())
      ).status,
    ).toBe(403);
    expect(
      (await request(buildApp()).post('/api/v1/operator/voice-consent').send(consentBody())).status,
    ).toBe(404);
  });

  it('accepts validated worker turns and verified consent administration', async () => {
    const worker = await request(buildApp())
      .post(`/api/v1/internal/voice/session/${SESSION_ID}/turn`)
      .set('authorization', `Bearer ${WORKER_TOKEN}`)
      .send(workerTurnBody());
    expect(worker.status).toBe(200);
    expect(worker.body).toMatchObject({ data: { connectionEpoch: 2, moves: [] } });

    const metric = await request(buildApp())
      .post(`/api/v1/internal/voice/session/${SESSION_ID}/metrics`)
      .set('authorization', `Bearer ${WORKER_TOKEN}`)
      .send({ connectionEpoch: 2, metric: { kind: 'stt', audioDurationMs: 400 } });
    expect(metric.status).toBe(202);

    const consent = await request(buildApp())
      .post('/api/v1/operator/voice-consent')
      .set('authorization', `Bearer ${OPERATOR_TOKEN}`)
      .send(consentBody());
    expect(consent.status).toBe(200);
  });
});

function buildApp(denyStudent = false) {
  const authorize: RequestHandler = denyStudent
    ? (_request, _response, next) => {
        next(new ForbiddenError('student access denied'));
      }
    : (request_, _response, next) => {
        Object.assign(request_, { studentId: STUDENT_ID });
        next();
      };
  const controller = createVoiceControllers({
    negotiate: () =>
      Promise.resolve({
        url: 'wss://voice.example.test',
        token: 'short-lived-token',
        room: `aria_${SESSION_ID}`,
        region: 'us-west',
        expiresAt: new Date(NOW.getTime() + 300_000).toISOString(),
        processors: ['media', 'stt', 'tts'],
        connectionEpoch: 2,
      }),
    workerTurn: () => Promise.resolve({ connectionEpoch: 2, moves: [] }),
    recordMetric: () => Promise.resolve(),
    grant: (input) =>
      Promise.resolve({
        id: '00000000-0000-4000-8000-000000000104',
        ...input,
        status: 'granted',
        grantedBy: null,
        processorMapVersion: null,
        verifiedAt: NOW,
        withdrawnAt: null,
      }),
    withdraw: () => Promise.resolve(true),
  });
  return createApp({
    config: CONFIG,
    logger: createLogger({ level: 'silent' }),
    clock: fixedClock(NOW),
    ids: sequentialIds('request'),
    voice: {
      student: { authorize, controller },
      worker: {
        authorize: workerOnly(WORKER_TOKEN),
        controller,
        bridges: bridgeControllers(),
        talk: { brief: unused, heard: unused, spoken: unused },
      },
      admin: { authorize: operatorOnly(OPERATOR_TOKEN), controller },
    },
  });
}

const BRIDGE_ASSET_ID = '00000000-0000-4000-8000-000000000105';

/** The talk endpoints have their own suite (`voice-talk.routes.test.ts`). */
const unused: RequestHandler = (_request, response) => {
  response.status(501).end();
};

function bridgeControllers() {
  return createVoiceBridgeControllers({
    bridges: {
      list: ({ band, voice }) =>
        Promise.resolve({
          band,
          voice,
          sampleRate: 24_000,
          clips: [{ id: BRIDGE_ASSET_ID, bucket: 'thinking', text: 'Let me think.' }],
        }),
      audio: () => Promise.resolve(new Uint8Array([0, 1, 0, 2])),
    },
  });
}

function workerTurnBody() {
  return {
    protocolVersion: PROTOCOL_VERSION,
    connectionEpoch: 2,
    acknowledgedSeq: 0,
    event: {
      id: 'event-1',
      at: NOW.toISOString(),
      protocolVersion: PROTOCOL_VERSION,
      sessionId: SESSION_ID,
      kind: 'RESUME',
    },
  };
}

function consentBody() {
  return {
    parentId: PARENT_ID,
    studentId: STUDENT_ID,
    processorCategories: ['media', 'stt', 'tts'],
    retainReadingAudio: false,
    verificationReference: 'verified-parent-consent-1',
  };
}

