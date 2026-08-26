import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { childListResponseSchema, childSummarySchema } from '@aria/shared';

import { createApp } from '@/app';
import { loadConfig } from '@/config';
import { fixedClock } from '@/lib/clock';
import { sequentialIds } from '@/lib/ids';
import { createLogger } from '@/lib/logger';
import {
  buildIdentity,
  NOW,
  PARENT_EMAIL,
  PARENT_ID,
  PARENT_TOKEN,
  SAM_ID,
  type IdentityFixture,
} from '@/routes/__fixtures__/identity-app.fixture';
import { parseEnvelope } from '@/testing/envelope';
import type { VoiceConsent } from '@/types/voice';

import type { Express } from 'express';

const CONSENT: VoiceConsent = {
  id: '00000000-0000-4000-8000-0000000000c1',
  parentId: PARENT_ID,
  studentId: SAM_ID,
  status: 'granted',
  processorCategories: ['media', 'stt', 'tts'],
  retainReadingAudio: false,
  verificationReference: 'card-check-1',
  grantedBy: PARENT_ID,
  processorMapVersion: 'abc123',
  verifiedAt: NOW,
  withdrawnAt: null,
};

const CONFIG = loadConfig(
  {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: 'postgresql://aria:aria@localhost:5432/aria_test',
    SUPABASE_URL: 'https://project.supabase.co',
    CHILD_SESSION_SECRET: 'c'.repeat(32),
  },
  'test',
);

function buildApp(fixture: IdentityFixture): Express {
  return createApp({
    config: CONFIG,
    logger: createLogger({ level: 'silent' }),
    clock: fixedClock(NOW),
    ids: sequentialIds('req'),
    identity: fixture.identity,
  });
}

const authed = (app: Express) => ({
  get: (path: string) => request(app).get(path).set('authorization', `Bearer ${PARENT_TOKEN}`),
  post: (path: string) => request(app).post(path).set('authorization', `Bearer ${PARENT_TOKEN}`),
  patch: (path: string) => request(app).patch(path).set('authorization', `Bearer ${PARENT_TOKEN}`),
});

/** The picker's list, which is this route: `GET /parent/children` and no second copy of it. */

describe('the parent surface', () => {
  it('refuses every route without a parent token', async () => {
    const app = buildApp(buildIdentity());

    for (const call of [
      request(app).get('/api/v1/parent/children'),
      request(app).post('/api/v1/parent/children').send({ displayName: 'Ada', grade: '2' }),
      request(app).patch(`/api/v1/parent/children/${SAM_ID}`).send({ displayName: 'Sammy' }),
      request(app).post(`/api/v1/parent/children/${SAM_ID}/consent/voice`).send({}),
      request(app).post('/api/v1/parent/sessions/revoke').send({}),
    ]) {
      await expect(call.then((response) => response.status)).resolves.toBe(401);
    }
  });

  it('lists the family and never its email address', async () => {
    const response = await authed(buildApp(buildIdentity())).get('/api/v1/parent/children');

    expect(response.status).toBe(200);
    expect(parseEnvelope(childListResponseSchema, response).children).toHaveLength(1);
    expect(response.text).not.toContain(PARENT_EMAIL);
  });

  it('adds a child and gives back the picker row for them', async () => {
    const response = await authed(buildApp(buildIdentity()))
      .post('/api/v1/parent/children')
      .send({ displayName: 'Ada', grade: 'K', avatar: 'whale' });

    expect(response.status).toBe(201);
    expect(parseEnvelope(childSummarySchema, response)).toMatchObject({
      firstName: 'Ada',
      grade: 'K',
      band: 'early',
      avatar: 'whale',
      loginMethod: 'none',
    });
  });

  it('rejects a body it does not recognise', async () => {
    const app = buildApp(buildIdentity());

    const badGrade = await authed(app)
      .post('/api/v1/parent/children')
      .send({ displayName: 'Ada', grade: '13' });
    const unknownKey = await authed(app)
      .patch(`/api/v1/parent/children/${SAM_ID}`)
      .send({ parentId: PARENT_ID });
    const badPicture = await authed(app)
      .patch(`/api/v1/parent/children/${SAM_ID}`)
      .send({ login: { pictureSequence: ['fox', 'dragon', 'owl'] } });

    expect(badGrade.status).toBe(400);
    expect(unknownKey.status).toBe(400);
    expect(badPicture.status).toBe(400);
  });

  /** Band follows grade; the parent app never gets to set the two at odds. */
  it('rederives the band when the grade changes', async () => {
    const response = await authed(buildApp(buildIdentity()))
      .patch(`/api/v1/parent/children/${SAM_ID}`)
      .send({ grade: '7' });

    expect(parseEnvelope(childSummarySchema, response)).toMatchObject({
      grade: '7',
      band: 'senior',
    });
  });

  /** P2H-12: "a parent can revoke all child sessions". */
  it('ends every device the family is signed in on, and says how many', async () => {
    const fixture = buildIdentity();
    const app = buildApp(fixture);
    await authed(app)
      .patch(`/api/v1/parent/children/${SAM_ID}`)
      .send({ login: { pin: '4321' } })
      .expect(200);
    const login = await authed(app)
      .post('/api/v1/auth/child/login')
      .send({ childId: SAM_ID, pin: '4321' })
      .expect(200);
    const cookie = login.headers['set-cookie']?.[0]?.split(';')[0] ?? '';

    const revoked = await authed(app).post('/api/v1/parent/sessions/revoke').send({});

    expect(revoked.status).toBe(200);
    expect(revoked.body).toEqual({ data: { revoked: 1 } });
    // The cookie stops working the moment the parent says so.
    await request(app).post('/api/v1/auth/child/refresh').set('Cookie', cookie).expect(401);
  });

  it('records who granted voice consent and what wording they were shown', async () => {
    const grant = vi.fn(() => Promise.resolve(CONSENT));
    const app = buildApp(buildIdentity({ consent: { grant, processorMapVersion: 'abc123' } }));

    const response = await authed(app)
      .post(`/api/v1/parent/children/${SAM_ID}/consent/voice`)
      .send({
        processorCategories: ['media', 'stt', 'tts'],
        verificationReference: 'card-check-1',
      });

    expect(response.status).toBe(200);
    expect(grant).toHaveBeenCalledWith({
      parentId: PARENT_ID,
      studentId: SAM_ID,
      processorCategories: ['media', 'stt', 'tts'],
      retainReadingAudio: false,
      verificationReference: 'card-check-1',
      grantedBy: PARENT_ID,
      processorMapVersion: 'abc123',
    });
  });

  it('will not grant consent for a child in another family', async () => {
    const grant = vi.fn();
    const app = buildApp(buildIdentity({ consent: { grant, processorMapVersion: 'abc123' } }));

    const response = await authed(app)
      .post('/api/v1/parent/children/00000000-0000-4000-8000-0000000000ff/consent/voice')
      .send({
        processorCategories: ['media', 'stt', 'tts'],
        verificationReference: 'card-check-1',
      });

    expect(response.status).toBe(404);
    expect(grant).not.toHaveBeenCalled();
  });

  /** Retaining a child's reading audio stays off until a ticket deliberately turns it on. */
  it('refuses a consent that tries to retain audio', async () => {
    const grant = vi.fn();
    const app = buildApp(buildIdentity({ consent: { grant, processorMapVersion: 'abc123' } }));

    const response = await authed(app)
      .post(`/api/v1/parent/children/${SAM_ID}/consent/voice`)
      .send({
        processorCategories: ['media', 'stt', 'tts'],
        retainReadingAudio: true,
        verificationReference: 'card-check-1',
      });

    expect(response.status).toBe(400);
  });

  it('answers 404 for voice consent where voice is not configured', async () => {
    const response = await authed(buildApp(buildIdentity()))
      .post(`/api/v1/parent/children/${SAM_ID}/consent/voice`)
      .send({
        processorCategories: ['media', 'stt', 'tts'],
        verificationReference: 'card-check-1',
      });

    expect(response.status).toBe(404);
  });
});
