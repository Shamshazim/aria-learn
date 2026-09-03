import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { childListResponseSchema } from '@aria/shared';

import { createApp } from '@/app';
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

/**
 * The four capabilities P0-28 adds, over HTTP (§6: fake at the port, not the service).
 *
 * Everything between the router and the two ports — the database and the identity provider —
 * is the real thing. A test that faked the devices service would prove the route exists;
 * these prove a tablet can sign a child in, and that revoking it stops them.
 */
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
  delete: (path: string) =>
    request(app).delete(path).set('authorization', `Bearer ${PARENT_TOKEN}`),
});

const CONSENT = { method: 'credit_card', sourceReference: 'card-1', disclosureVersion: 'v1' };

/** The shapes these routes promise, parsed rather than reached into (see `parseEnvelope`). */
const issuedDeviceSchema = z.object({ id: z.uuid(), label: z.string(), secret: z.string() });
const consentSchema = z.object({
  id: z.uuid(),
  method: z.string(),
  disclosureVersion: z.string(),
});
const childSchema = z.object({ id: z.uuid() });
const endedSchema = z.object({ ended: z.number() });

async function consented(app: Express): Promise<void> {
  await authed(app).post('/api/v1/parent/consent').send(CONSENT);
}

/** A device trusted for Sam, and the secret it holds. Returned once, here and never again. */
async function trustDevice(app: Express, childIds: readonly string[] = [SAM_ID]) {
  const response = await authed(app)
    .post('/api/v1/parent/devices')
    .send({ label: 'Kitchen tablet', childIds: [...childIds] });
  expect(response.status).toBe(201);
  return parseEnvelope(issuedDeviceSchema, response);
}

describe('verifiable parental consent', () => {
  it('refuses to create a child before anybody consented', async () => {
    const response = await authed(buildApp(buildIdentity()))
      .post('/api/v1/parent/children')
      .send({ displayName: 'Ada', grade: 'K' });

    expect(response.status).toBe(403);
    // Its own code, so the parent app can route to the consent screen rather than to an
    // "access denied" that names nothing the parent can do.
    expect(parseError(response).code).toBe('CONSENT_REQUIRED');
  });

  it('lets the same request through once consent is recorded', async () => {
    const app = buildApp(buildIdentity());
    await consented(app);

    const response = await authed(app)
      .post('/api/v1/parent/children')
      .send({ displayName: 'Ada', grade: 'K' });

    expect(response.status).toBe(201);
  });

  it('keeps withdrawn consent in the history, because that is the audit answer', async () => {
    const app = buildApp(buildIdentity());
    await consented(app);

    const response = await authed(app).get('/api/v1/parent/consent');

    expect(response.status).toBe(200);
    expect(parseEnvelope(z.array(consentSchema), response)).toMatchObject([
      { method: 'credit_card', disclosureVersion: 'v1' },
    ]);
  });

  it('refuses a method that is not one the FTC approves', async () => {
    const response = await authed(buildApp(buildIdentity()))
      .post('/api/v1/parent/consent')
      .send({ ...CONSENT, method: 'pinky_promise' });

    expect(response.status).toBe(400);
  });
});

describe('a device a parent trusts', () => {
  it('hands back the secret exactly once, and never lists it again', async () => {
    const app = buildApp(buildIdentity());
    const device = await trustDevice(app);

    expect(device.secret).toEqual(expect.any(String));

    const listed = await authed(app).get('/api/v1/parent/devices');
    expect(listed.status).toBe(200);
    expect(parseEnvelope(z.array(z.object({ id: z.uuid() })), listed)).toHaveLength(1);
    expect(listed.text).not.toContain(device.secret);
  });

  it('answers the picker with no parent token anywhere near the request', async () => {
    const app = buildApp(buildIdentity());
    const device = await trustDevice(app);

    const response = await request(app)
      .get('/api/v1/device/children')
      .set('x-aria-device', device.secret);

    // A positive assertion, deliberately. Every other test here expects a 401, and a device
    // secret that was silently malformed would satisfy all of them while proving nothing.
    expect(response.status).toBe(200);
    expect(parseEnvelope(childListResponseSchema, response).children[0]?.id).toBe(SAM_ID);
  });

  it('still asks the child for their credential', async () => {
    const app = buildApp(buildIdentity());
    const device = await trustDevice(app);

    const response = await request(app)
      .post('/api/v1/device/children/login')
      .set('x-aria-device', device.secret)
      .send({ childId: SAM_ID, pin: '1234' });

    // A trusted device says which tablet this is. It does not say who is holding it.
    expect(response.status).toBe(401);
    expect(parseError(response).code).toBe('UNAUTHORIZED');
  });

  it('refuses a grant that names no child, so no secret can open nothing', async () => {
    const response = await authed(buildApp(buildIdentity()))
      .post('/api/v1/parent/devices')
      .send({ label: 'Kitchen tablet', childIds: [] });

    expect(response.status).toBe(400);
  });

  /**
   * The reason a grant names children rather than a family. A tablet that leaves the house is
   * a tablet that can reach the one child it was given, not everybody's account.
   */
  it('shows the picker only the children the grant names', async () => {
    const app = buildApp(buildIdentity());
    await consented(app);
    const sibling = await authed(app)
      .post('/api/v1/parent/children')
      .send({ displayName: 'Ada', grade: 'K' });
    const siblingId = parseEnvelope(childSchema, sibling).id;

    const device = await trustDevice(app, [SAM_ID]);

    const picker = await request(app)
      .get('/api/v1/device/children')
      .set('x-aria-device', device.secret);

    expect(picker.status).toBe(200);
    const shown = parseEnvelope(childListResponseSchema, picker).children;
    expect(shown).toHaveLength(1);
    expect(shown[0]?.id).toBe(SAM_ID);

    // And not merely hidden: signing the sibling in from this device is refused outright.
    const login = await request(app)
      .post('/api/v1/device/children/login')
      .set('x-aria-device', device.secret)
      .send({ childId: siblingId, pin: '1234' });

    expect(login.status).toBe(401);
  });

  it('refuses an unknown device secret', async () => {
    const response = await request(buildApp(buildIdentity()))
      .get('/api/v1/device/children')
      .set('x-aria-device', 'not-a-secret-we-issued');

    expect(response.status).toBe(401);
  });

  it('refuses a device route with no secret at all', async () => {
    const response = await request(buildApp(buildIdentity())).get('/api/v1/device/children');

    expect(response.status).toBe(401);
  });

  it('stops working the moment the parent revokes it', async () => {
    const app = buildApp(buildIdentity());
    const device = await trustDevice(app);

    const before = await request(app)
      .get('/api/v1/device/children')
      .set('x-aria-device', device.secret);
    expect(before.status).toBe(200);

    const revoked = await authed(app).delete(`/api/v1/parent/devices/${device.id}`);
    expect(revoked.status).toBe(204);

    const after = await request(app)
      .get('/api/v1/device/children')
      .set('x-aria-device', device.secret);
    expect(after.status).toBe(401);
  });

  it('refuses to revoke a grant that is not this parent’s', async () => {
    const app = buildApp(buildIdentity());
    const response = await authed(app).delete(
      '/api/v1/parent/devices/00000000-0000-4000-8000-0000000000ff',
    );

    expect(response.status).toBe(404);
  });
});

describe('erasure', () => {
  it('deletes a child and answers with no content', async () => {
    const app = buildApp(buildIdentity());
    await consented(app);

    const response = await authed(app).delete(`/api/v1/parent/children/${SAM_ID}`);

    expect(response.status).toBe(204);
  });

  it('deletes the account and the provider user behind it', async () => {
    const fixture = buildIdentity();
    const app = buildApp(fixture);

    const response = await authed(app).delete('/api/v1/parent/account');

    expect(response.status).toBe(204);
    expect(fixture.deletedProviderUsers).toEqual(['supabase-1']);
  });
});

describe('signing out everywhere', () => {
  it('ends the session, so the very next request is refused', async () => {
    const app = buildApp(buildIdentity());

    const signOut = await authed(app).post('/api/v1/parent/sessions/sign-out-everywhere');
    expect(signOut.status).toBe(200);
    expect(parseEnvelope(endedSchema, signOut)).toEqual({ ended: 1 });

    // The token is still valid and still verifies. The row it hangs on is what refuses it,
    // which is the whole point: a JWT cannot be recalled and a row can.
    const after = await authed(app).get('/api/v1/parent/children');
    expect(after.status).toBe(401);
  });
});
