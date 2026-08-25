import { createApp } from '@/app';
import { loadConfig } from '@/config';
import { sequentialSecrets } from '@/identity';
import { createFakeIdentityProvider } from '@/identity/provider/fake.provider';
import type { FakeIdentityProvider } from '@/identity/provider/fake.provider';
import { createIdentityRuntime } from '@/identity.runtime';
import type { IdentityRuntime } from '@/identity.runtime';
import type { Clock } from '@/lib/clock';
import { sequentialUuids } from '@/lib/ids';
import { createLogger } from '@/lib/logger';

import type { TestDatabase } from './db.harness';
import type { Express } from 'express';

/**
 * One app, wired the way `server.ts` wires it, against a real database and a fake identity
 * provider.
 *
 * The provider is faked at the port, which is what the ticket asks for: the normal suite needs
 * no live credentials, and every service above the port runs exactly as it does in production.
 * Everything else here is real — the same routers, the same middleware, the same SQL.
 */
export const IDENTITY_ENV = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://unused@localhost:5432/unused',
  IDENTITY_PROVIDER: 'fake',
  LOG_LEVEL: 'silent',
} as const;

export type IdentityFixture = {
  app: Express;
  provider: FakeIdentityProvider;
  runtime: IdentityRuntime;
  /** Advances the fixture's clock, so lifetimes can be crossed without waiting for them. */
  advance(ms: number): void;
  now(): Date;
};

export function createIdentityFixture(database: TestDatabase): IdentityFixture {
  let current = new Date('2026-08-24T12:00:00.000Z');
  const clock: Clock = { now: () => current };

  const config = loadConfig({ ...IDENTITY_ENV }, '0.0.0-test');
  const provider = createFakeIdentityProvider(() => current);
  const logger = createLogger({ level: 'silent' });

  const runtime = createIdentityRuntime({
    pool: database.pool,
    config,
    ids: sequentialUuids(),
    clock,
    logger,
    fetch: unreachableFetch,
    secrets: sequentialSecrets(),
    provider,
  });

  return {
    app: createApp({ config, logger, clock, ids: sequentialUuids(), identity: runtime.router }),
    provider,
    runtime,
    advance: (ms) => {
      current = new Date(current.getTime() + ms);
    },
    now: () => current,
  };
}

/**
 * The fake provider makes no network calls, so reaching `fetch` at all is a wiring bug worth
 * failing on rather than a request worth mocking.
 */
const unreachableFetch: typeof globalThis.fetch = () => {
  throw new Error('the identity fixture must not make a network call');
};
