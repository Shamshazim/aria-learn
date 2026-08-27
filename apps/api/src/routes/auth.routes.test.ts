import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { childSessionResponseSchema } from '@aria/shared';

import { createApp } from '@/app';
import { CHILD_SESSION_IDLE_MS } from '@/auth';
import { loadConfig } from '@/config';
import { fixedClock } from '@/lib/clock';
import { sequentialIds } from '@/lib/ids';
import { createLogger } from '@/lib/logger';
import {
  buildIdentity,
  NOW,
  PARENT_TOKEN,
  SAM_ID,
  type IdentityFixture,
} from '@/routes/__fixtures__/identity-app.fixture';
import { parseEnvelope, parseError } from '@/testing/envelope';

import type { Express } from 'express';

const COOKIE_SECRET = 'c'.repeat(32);
const CONFIG = loadConfig(
  {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: 'postgresql://aria:aria@localhost:5432/aria_test',
    SUPABASE_URL: 'https://project.supabase.co',
    CHILD_SESSION_SECRET: COOKIE_SECRET,
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

const asParent = (app: Express, path: string) =>
  request(app).post(path).set('authorization', `Bearer ${PARENT_TOKEN}`);

/**
 * The cookie is carried by hand rather than by `request.agent`.
 *
 * A cookie jar honours `Expires` against the real wall clock, and these tests run on a fixed
 * clock in 2026 — so a jar would quietly drop the session and every assertion after it would
 * be testing that a signed-out device is signed out.
 */
const childSession = (response: request.Response) =>
  parseEnvelope(childSessionResponseSchema, response);

function cookieFrom(response: request.Response): string {
  const header = response.headers['set-cookie']?.[0];
  if (header === undefined) throw new Error('no session cookie was set');
  return header.split(';')[0] ?? '';
}

async function signIn(app: Express): Promise<Readonly<{ cookie: string }>> {
  await setPin(app, '4321');
  const response = await asParent(app, '/api/v1/auth/child/login')
    .send({ childId: SAM_ID, pin: '4321' })
    .expect(200);
  return { cookie: cookieFrom(response) };
}

async function setPin(app: Express, pin: string): Promise<void> {
  await request(app)
    .patch(`/api/v1/parent/children/${SAM_ID}`)
    .set('authorization', `Bearer ${PARENT_TOKEN}`)
    .send({ login: { pin } })
    .expect(200);
}

describe('signing a child in', () => {
  it('refuses a login from a device nobody has signed in on', async () => {
    const response = await request(buildApp(buildIdentity()))
      .post('/api/v1/auth/child/login')
      .send({ childId: SAM_ID, pin: '4321' });

    expect(response.status).toBe(401);
    expect(parseError(response).code).toBe('UNAUTHORIZED');
  });

  it('refuses a token that is not ours', async () => {
    const response = await request(buildApp(buildIdentity()))
      .post('/api/v1/auth/child/login')
      .set('authorization', 'Bearer forged')
      .send({ childId: SAM_ID, pin: '4321' });

    expect(response.status).toBe(401);
  });

  it('issues an http-only cookie on a correct PIN and says when it runs out', async () => {
    const app = buildApp(buildIdentity());
    await setPin(app, '4321');

    const response = await asParent(app, '/api/v1/auth/child/login').send({
      childId: SAM_ID,
      pin: '4321',
      deviceLabel: 'kitchen tablet',
    });

    expect(response.status).toBe(200);
    expect(childSession(response)).toMatchObject({
      child: { firstName: 'Sam' },
      idleExpiresAt: new Date(NOW.getTime() + CHILD_SESSION_IDLE_MS).toISOString(),
    });
    const cookie = response.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toContain('aria_child_session=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    // The token is in the header and nowhere else.
    expect(response.text).not.toContain('secret-');
  });

  it('refuses the wrong PIN without saying which half was wrong', async () => {
    const app = buildApp(buildIdentity());
    await setPin(app, '4321');

    const response = await asParent(app, '/api/v1/auth/child/login').send({
      childId: SAM_ID,
      pin: '0000',
    });

    expect(response.status).toBe(401);
    expect(parseError(response).message).toBe('Please sign in again.');
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  /** P2H-12: the sixth try is a locked door, and the child is told to ask a grown-up. */
  it('locks after five wrong PINs and never shows a countdown', async () => {
    const app = buildApp(buildIdentity());
    await setPin(app, '4321');

    let last = await asParent(app, '/api/v1/auth/child/login').send({
      childId: SAM_ID,
      pin: '0'.repeat(4),
    });
    for (let attempt = 0; attempt < 4; attempt += 1) {
      last = await asParent(app, '/api/v1/auth/child/login').send({ childId: SAM_ID, pin: '0000' });
    }

    expect(last.status).toBe(423);
    expect(parseError(last).message).toBe('Ask a grown-up for help.');
    expect(last.text).not.toMatch(/\d+ ?(minute|second)/u);
  });

  it('rejects a body that is not a login', async () => {
    const app = buildApp(buildIdentity());

    const badPin = await asParent(app, '/api/v1/auth/child/login').send({
      childId: SAM_ID,
      pin: 'abcd',
    });
    const unknownKey = await asParent(app, '/api/v1/auth/child/login').send({
      childId: SAM_ID,
      pin: '1234',
      admin: true,
    });

    expect(badPin.status).toBe(400);
    expect(unknownKey.status).toBe(400);
  });

  it('refuses to sign in a child from another family', async () => {
    const app = buildApp(buildIdentity());

    const response = await asParent(app, '/api/v1/auth/child/login').send({
      childId: '00000000-0000-4000-8000-0000000000ff',
      pin: '1234',
    });

    expect(response.status).toBe(404);
  });

  it('signs out, clears the cookie, and stops accepting it', async () => {
    const app = buildApp(buildIdentity());
    const { cookie } = await signIn(app);

    const out = await request(app).post('/api/v1/auth/child/logout').set('Cookie', cookie);
    expect(out.status).toBe(200);
    expect(out.headers['set-cookie']?.[0]).toContain('Expires=Thu, 01 Jan 1970');

    await request(app).post('/api/v1/auth/child/refresh').set('Cookie', cookie).expect(401);
  });

  it('refuses a refresh from a device with no session at all', async () => {
    const response = await request(buildApp(buildIdentity())).post('/api/v1/auth/child/refresh');

    expect(response.status).toBe(401);
  });

  it('rotates the cookie on refresh and stops accepting the old one', async () => {
    const app = buildApp(buildIdentity());
    const { cookie } = await signIn(app);

    const refreshed = await request(app)
      .post('/api/v1/auth/child/refresh')
      .set('Cookie', cookie)
      .expect(200);

    const rotated = cookieFrom(refreshed);
    expect(rotated).not.toBe(cookie);
    await request(app).post('/api/v1/auth/child/refresh').set('Cookie', rotated).expect(200);
    await request(app).post('/api/v1/auth/child/refresh').set('Cookie', cookie).expect(401);
  });
});
