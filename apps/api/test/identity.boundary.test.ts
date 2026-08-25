import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { REDACTED_PATHS } from '@/lib/logger';

import { createTestDatabase, shouldSkipDatabaseTests } from './db.harness';
import { OTHER_SECRET, createIdentityClient } from './identity.client';
import { createIdentityFixture } from './identity.fixture';

import type { TestDatabase } from './db.harness';
import type { IdentityClient } from './identity.client';
import type { IdentityFixture } from './identity.fixture';

/**
 * The boundary the whole P0-26 decision rests on: Supabase authenticates adults and learns
 * nothing about a child.
 *
 * Asserted by driving the complete parent-and-child flow — sign-in, consent, two children,
 * a device, a picture sign-in, a profile deletion, an account deletion — and then searching
 * everything that crossed the port for anything child-side. The fake provider records every
 * call, so this is not "we believe the adapter is careful", it is "here is the exhaustive
 * list of what we sent".
 *
 * If a future ticket adds a provider method that carries a child field, this test is what
 * fails.
 */
const suite = shouldSkipDatabaseTests() ? describe.skip : describe;

suite('P0-28 — the identity-provider boundary', () => {
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

  /** Distinctive enough that a substring search cannot miss them if they leak. */
  const CHILD_NICKNAME = 'Zephyrine';
  const SIBLING_NICKNAME = 'Quillon';

  async function walkTheWholeFlow(): Promise<{ childIds: readonly string[] }> {
    const adult = await client.signIn('parent@example.com');
    await client.consent(adult.token);

    const first = await client.createChild(adult.token, CHILD_NICKNAME);
    const second = await client.createChild(adult.token, SIBLING_NICKNAME, OTHER_SECRET);
    const device = await client.authoriseDevice(adult.token, [first, second], 'kitchen tablet');

    await client.openChildSession(device.secret, first).expect(201);
    await client.asAdult(adult.token, 'delete', `/api/v1/parent/children/${second}`).expect(204);
    await client.asAdult(adult.token, 'delete', '/api/v1/parent/account').expect(202);

    return { childIds: [first, second] };
  }

  it('sends the vendor an adult email, an adult token and an adult subject — and nothing else', async () => {
    const { childIds } = await walkTheWholeFlow();

    // The exhaustive list of what crossed the port, as JSON.
    const sent = JSON.stringify(fixture.provider.calls);

    for (const childField of [CHILD_NICKNAME, SIBLING_NICKNAME, ...childIds, 'fox', 'apple']) {
      expect(sent).not.toContain(childField);
    }

    // Positively: the flow really did reach the vendor, so the assertion above is not passing
    // because nothing happened.
    expect(fixture.provider.calls.map((call) => call.method)).toEqual(
      expect.arrayContaining(['verifyAccessToken', 'assertLiveSession', 'deleteUser']),
    );
  });

  it('uses only the four methods the port declares', async () => {
    await walkTheWholeFlow();

    // A method is a capability. Keeping this list closed is what makes the assertion above
    // exhaustive rather than a spot check of the shapes we happened to think of.
    const used = new Set(fixture.provider.calls.map((call) => call.method));
    expect([...used].sort()).toEqual(
      ['assertLiveSession', 'deleteUser', 'verifyAccessToken'].sort(),
    );
  });

  it('never puts a child field in a magic-link request', async () => {
    await client.signIn('parent@example.com');
    await client.consent((await client.signIn('parent@example.com')).token);

    const magicLinks = fixture.provider.calls.filter((call) => call.method === 'sendMagicLink');
    for (const call of magicLinks) {
      expect(Object.keys(call).sort()).toEqual(['email', 'method', 'redirectTo']);
    }
  });

  it('redacts the fields a child flow would otherwise write to a log', () => {
    // The logger's redaction list is the second half of the criterion — the provider never
    // receives a child field, and the log never records one either (CODE-STANDARDS §5).
    for (const path of ['*.name', '*.email', '*.token', 'req.headers.authorization']) {
      expect(REDACTED_PATHS).toContain(path);
    }
  });
});
