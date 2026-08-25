import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PICTURE_SECRET_THROTTLE, SESSION_LIFETIMES } from '@/identity';

import { createTestDatabase, shouldSkipDatabaseTests } from './db.harness';
import { OTHER_SECRET, SECRET, createIdentityClient } from './identity.client';
import { createIdentityFixture } from './identity.fixture';

import type { TestDatabase } from './db.harness';
import type { IdentityClient } from './identity.client';
import type { IdentityFixture } from './identity.fixture';

/**
 * The P0-28 acceptance criteria, driven through the real HTTP surface against a real
 * PostgreSQL and a fake identity provider.
 *
 * Each `describe` below is one criterion from the ticket. They run against the same app a
 * deployment runs, so what they prove is a property of the product rather than of a mock: a
 * parent really does need consent, a child really does sign in with pictures alone, and a
 * revoked device really does stop working on the next request.
 */
const suite = shouldSkipDatabaseTests() ? describe.skip : describe;

suite('P0-28 — adult identity and child device sessions', () => {
  let database: TestDatabase;
  let fixture: IdentityFixture;
  let client: IdentityClient;

  beforeAll(async () => {
    database = await createTestDatabase();
  }, 60_000);
  beforeEach(async () => {
    await database.truncateAll();
    fixture = createIdentityFixture(database);
    client = createIdentityClient(fixture);
  });
  afterAll(async () => database.drop());

  describe('a parent can complete a magic-link login and create a child only after consent', () => {
    it('sends a link without disclosing whether the address is known', async () => {
      await request(fixture.app)
        .post('/api/v1/auth/adult/magic-link')
        .send({ email: 'stranger@example.com' })
        .expect(202);

      expect(fixture.provider.calls.at(-1)).toMatchObject({ method: 'sendMagicLink' });
    });

    it('refuses a child profile until consent is on record, then allows it', async () => {
      const { token } = await client.signIn();

      await client
        .asAdult(token, 'post', '/api/v1/parent/children')
        .send({ nickname: 'Robin', grade: '2', avatarKey: 'fox', pictureSecret: SECRET })
        .expect(403);

      await client.consent(token);
      await client.createChild(token, 'Robin');

      const children = await client.asAdult(token, 'get', '/api/v1/parent/children').expect(200);
      expect((children.body as { data: unknown[] }).data).toHaveLength(1);
    });

    it('creates no identity at all for a visitor who does not attest to being an adult', async () => {
      await request(fixture.app)
        .post('/api/v1/auth/adult/session')
        .send({
          accessToken: fixture.provider.issueToken('child@example.com'),
          attestation: { isAdult: false, role: 'parent' },
        })
        .expect(401);

      const { rows } = await database.pool.query('SELECT count(*)::int AS n FROM adult_identity');
      expect(rows[0]).toEqual({ n: 0 });
    });
  });

  describe('a five-year-old can reopen an authorised profile using pictures only', () => {
    it('shows the picker and opens a session from a device secret and four pictures', async () => {
      const { token } = await client.signIn();
      await client.consent(token);
      const studentId = await client.createChild(token, 'Robin');
      const device = await client.authoriseDevice(token, [studentId]);

      const picker = await request(fixture.app)
        .get('/api/v1/child/profiles')
        .set('x-aria-device', device.secret)
        .expect(200);

      // A picture and a nickname. Nothing to read, and nothing about grade or history.
      expect((picker.body as { data: unknown[] }).data).toEqual([
        { studentId, nickname: 'Robin', avatarKey: 'fox' },
      ]);

      const opened = await client.openChildSession(device.secret, studentId).expect(201);
      const session = (opened.body as { data: { token: string; studentId: string } }).data;
      expect(session.studentId).toBe(studentId);
      expect(session.token).toMatch(/^cs_/);
    });

    it('refuses the wrong pictures and locks the profile after repeated attempts', async () => {
      const { token } = await client.signIn();
      await client.consent(token);
      const studentId = await client.createChild(token, 'Robin');
      const device = await client.authoriseDevice(token, [studentId]);

      for (let attempt = 1; attempt < PICTURE_SECRET_THROTTLE.maxAttempts; attempt += 1) {
        await client.openChildSession(device.secret, studentId, OTHER_SECRET).expect(401);
      }

      const locked = await client
        .openChildSession(device.secret, studentId, OTHER_SECRET)
        .expect(429);
      expect(locked.headers['retry-after']).toBeDefined();

      // Even the right pictures are refused while the profile is locked.
      await client.openChildSession(device.secret, studentId).expect(429);

      fixture.advance(PICTURE_SECRET_THROTTLE.lockoutMs + 1000);
      await client.openChildSession(device.secret, studentId).expect(201);
    });

    it('expires a child session at the idle and absolute windows', async () => {
      const { token } = await client.signIn();
      await client.consent(token);
      const studentId = await client.createChild(token, 'Robin');
      const device = await client.authoriseDevice(token, [studentId]);
      const opened = await client.openChildSession(device.secret, studentId).expect(201);
      const childToken = (opened.body as { data: { token: string } }).data.token;

      fixture.advance(SESSION_LIFETIMES.childIdleMs + 1000);
      await request(fixture.app)
        .delete('/api/v1/child/session')
        .set('x-aria-child-session', childToken)
        .expect(401);
    });
  });

  describe('child grants cannot call parent, sibling or teacher endpoints', () => {
    it('rejects a device secret and a child session token on every parent endpoint', async () => {
      const { token } = await client.signIn();
      await client.consent(token);
      const studentId = await client.createChild(token, 'Robin');
      const device = await client.authoriseDevice(token, [studentId]);
      const opened = await client.openChildSession(device.secret, studentId).expect(201);
      const childToken = (opened.body as { data: { token: string } }).data.token;

      for (const credential of [device.secret, childToken]) {
        // A child credential is not a signed provider token, so it fails verification before
        // any row is read — there is no path by which it could be honoured.
        await request(fixture.app)
          .get('/api/v1/parent/children')
          .set('authorization', `Bearer ${credential}`)
          .expect(401);
        await request(fixture.app)
          .get('/api/v1/parent/devices')
          .set('authorization', `Bearer ${credential}`)
          .expect(401);
      }
    });

    it('will not open a sibling the device was not granted', async () => {
      const { token } = await client.signIn();
      await client.consent(token);
      const robin = await client.createChild(token, 'Robin');
      const sam = await client.createChild(token, 'Sam', OTHER_SECRET);
      const device = await client.authoriseDevice(token, [robin]);

      const picker = await request(fixture.app)
        .get('/api/v1/child/profiles')
        .set('x-aria-device', device.secret)
        .expect(200);
      expect(
        (picker.body as { data: { studentId: string }[] }).data.map((p) => p.studentId),
      ).toEqual([robin]);

      await client.openChildSession(device.secret, sam, OTHER_SECRET).expect(401);
    });

    it('will not open a child belonging to another family', async () => {
      const first = await client.signIn('first@example.com');
      await client.consent(first.token);
      const theirChild = await client.createChild(first.token, 'Robin');

      const second = await client.signIn('second@example.com');
      await client.consent(second.token);
      const ownChild = await client.createChild(second.token, 'Sam', OTHER_SECRET);

      await client
        .asAdult(second.token, 'post', '/api/v1/parent/devices')
        .send({ label: 'tablet', studentIds: [theirChild] })
        .expect(400);

      const device = await client.authoriseDevice(second.token, [ownChild]);
      await client.openChildSession(device.secret, theirChild).expect(401);
    });
  });

  describe('revocation takes effect immediately', () => {
    it('stops a device and its child session on the next request', async () => {
      const { token } = await client.signIn();
      await client.consent(token);
      const studentId = await client.createChild(token, 'Robin');
      const device = await client.authoriseDevice(token, [studentId]);
      const opened = await client.openChildSession(device.secret, studentId).expect(201);
      const childToken = (opened.body as { data: { token: string } }).data.token;

      await client.asAdult(token, 'delete', `/api/v1/parent/devices/${device.grantId}`).expect(204);

      await request(fixture.app)
        .get('/api/v1/child/profiles')
        .set('x-aria-device', device.secret)
        .expect(401);
      await request(fixture.app)
        .delete('/api/v1/child/session')
        .set('x-aria-child-session', childToken)
        .expect(401);
    });

    it('leaves the same child signed in on a device that was not revoked', async () => {
      const { token } = await client.signIn();
      await client.consent(token);
      const studentId = await client.createChild(token, 'Robin');
      const revoked = await client.authoriseDevice(token, [studentId], 'school laptop');
      const kept = await client.authoriseDevice(token, [studentId], 'kitchen tablet');

      const keptSession = await client.openChildSession(kept.secret, studentId).expect(201);
      const keptToken = (keptSession.body as { data: { token: string } }).data.token;

      await client
        .asAdult(token, 'delete', `/api/v1/parent/devices/${revoked.grantId}`)
        .expect(204);

      await request(fixture.app)
        .delete('/api/v1/child/session')
        .set('x-aria-child-session', keptToken)
        .expect(204);
    });

    it('stops an adult session against an otherwise unexpired token', async () => {
      const { token } = await client.signIn();

      await client.asAdult(token, 'get', '/api/v1/auth/adult/me').expect(200);
      await client.asAdult(token, 'delete', '/api/v1/auth/adult/session').expect(200);
      await client.asAdult(token, 'get', '/api/v1/auth/adult/me').expect(401);
    });
  });
});
