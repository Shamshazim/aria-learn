import request from 'supertest';

import type { PictureSecret } from '@aria/shared';

import type { IdentityFixture } from './identity.fixture';
import type { Test } from 'supertest';

/**
 * The parent-and-child flow, as one object the tests drive.
 *
 * Every helper here is a real HTTP request against the real router, so a test that uses them
 * is still an end-to-end test — they exist so each test reads as the property it asserts
 * rather than as six requests of setup, and so the boundary test drives exactly the same flow
 * a parent does.
 */
export const SECRET: PictureSecret = ['apple', 'moon', 'apple', 'kite'];
export const OTHER_SECRET: PictureSecret = ['star', 'star', 'boat', 'drum'];

export type SignedInAdult = { token: string; adultId: string; parentId: string | null };
export type IssuedDevice = { grantId: string; secret: string };

export type IdentityClient = {
  signIn(email?: string, role?: 'parent' | 'teacher'): Promise<SignedInAdult>;
  asAdult(token: string, method: 'get' | 'post' | 'put' | 'delete', path: string): Test;
  consent(token: string): Promise<void>;
  createChild(token: string, nickname: string, pictureSecret?: PictureSecret): Promise<string>;
  authoriseDevice(
    token: string,
    studentIds: readonly string[],
    label?: string,
  ): Promise<IssuedDevice>;
  openChildSession(secret: string, studentId: string, pictureSecret?: PictureSecret): Test;
  /** The full path a family walks: consent, one child, one device, one open session. */
  aFamily(email?: string): Promise<{
    adult: SignedInAdult;
    studentId: string;
    device: IssuedDevice;
    childToken: string;
  }>;
};

/** A field the API documents as a string. A different shape is a failing test, not a coercion. */
function text(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError(`expected a string, got ${typeof value}`);
  return value;
}

/** Every response in this API is `{ data }`; this unwraps it without repeating the cast. */
function data(body: unknown): Record<string, unknown> {
  return (body as { data: Record<string, unknown> }).data;
}

export function createIdentityClient(fixture: IdentityFixture): IdentityClient {
  const client: IdentityClient = {
    ...adultFlow(fixture),
    ...childFlow(fixture),

    async aFamily(email = 'parent@example.com') {
      const adult = await client.signIn(email);
      await client.consent(adult.token);
      const studentId = await client.createChild(adult.token, 'Robin');
      const device = await client.authoriseDevice(adult.token, [studentId]);
      const opened = await client.openChildSession(device.secret, studentId).expect(201);

      return { adult, studentId, device, childToken: text(data(opened.body).token) };
    },
  };

  return client;
}

/** Everything a parent does, with the adult credential. */
function adultFlow(fixture: IdentityFixture) {
  const client = {
    async signIn(email = 'parent@example.com', role: 'parent' | 'teacher' = 'parent') {
      const token = fixture.provider.issueToken(email);
      const response = await request(fixture.app)
        .post('/api/v1/auth/adult/session')
        .send({ accessToken: token, attestation: { isAdult: true, role } })
        .expect(200);

      const { adultId, parentId } = data(response.body);
      return {
        token,
        adultId: text(adultId),
        parentId: typeof parentId === 'string' ? parentId : null,
      };
    },

    asAdult: (token: string, method: 'get' | 'post' | 'put' | 'delete', path: string) =>
      request(fixture.app)[method](path).set('authorization', `Bearer ${token}`),

    async consent(token: string) {
      await client
        .asAdult(token, 'post', '/api/v1/parent/consent')
        .send({ method: 'monetary_transaction', sourceReference: 'txn_123' })
        .expect(201);
    },

    async createChild(token: string, nickname: string, pictureSecret: PictureSecret = SECRET) {
      const response = await client
        .asAdult(token, 'post', '/api/v1/parent/children')
        .send({ nickname, grade: '2', avatarKey: 'fox', pictureSecret })
        .expect(201);
      return text(data(response.body).studentId);
    },

    async authoriseDevice(token: string, studentIds: readonly string[], label = 'kitchen tablet') {
      const response = await client
        .asAdult(token, 'post', '/api/v1/parent/devices')
        .send({ label, studentIds: [...studentIds] })
        .expect(201);
      const { grantId, secret } = data(response.body);
      return { grantId: text(grantId), secret: text(secret) };
    },
  };

  return client;
}

/** Everything a device and a child do, with no adult credential at all. */
function childFlow(fixture: IdentityFixture) {
  return {
    openChildSession: (secret: string, studentId: string, pictureSecret: PictureSecret = SECRET) =>
      request(fixture.app)
        .post('/api/v1/child/session')
        .set('x-aria-device', secret)
        .send({ studentId, pictureSecret }),
  };
}
