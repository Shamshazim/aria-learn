import { createHash } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createIdempotencyRepository } from '@/repositories/idempotency.repository';
import { createPostgresRateLimitStore } from '@/repositories/rate-limit.repository';
import type { IdempotencyKey } from '@/types/idempotency';
import type { RateLimitKey, RateLimitPolicy } from '@/types/rate-limit';

import { createTestDatabase, shouldSkipDatabaseTests } from './db.harness';

import type { TestDatabase } from './db.harness';

/**
 * The two X-05 stores against real Postgres.
 *
 * Their in-memory counterparts are exercised by the unit tests; what those cannot show is the
 * part that only SQL decides — that a claim is atomic, that a bucket refills against the
 * database's own clock, and that a row lock is what stops two instances spending the same
 * token. Every assertion here is about behaviour the driver, not the algorithm, is responsible
 * for.
 */
const suite = shouldSkipDatabaseTests() ? describe.skip : describe;
const POLICY: RateLimitPolicy = { burst: 3, refillPerMinute: 60 };

function bucketKey(overrides: Partial<RateLimitKey> = {}): RateLimitKey {
  return { actorClass: 'student', actorId: 'child-a', routeClass: 'turn', ...overrides };
}

/**
 * A real SHA-256-shaped hash. The column checks its length, because a value that is not one is
 * a caller who computed something other than a body hash.
 */
function hash(seed: string): string {
  return createHash('sha256').update(seed).digest('hex');
}

function recordKey(overrides: Partial<IdempotencyKey> = {}): IdempotencyKey {
  return {
    key: 'tap-once-please',
    actorClass: 'student',
    actorId: 'child-a',
    route: 'POST /student/session/turn',
    ...overrides,
  };
}

suite('X-05 stores in Postgres', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
  }, 60_000);
  afterAll(async () => {
    await database.drop();
  });
  beforeEach(async () => {
    await database.truncateAll();
  });

  describe('rate limit bucket', () => {
    it('starts an unseen actor full, then refuses once the burst is spent', async () => {
      const store = createPostgresRateLimitStore(database.pool);
      const now = new Date();

      const spent = [];
      for (let i = 0; i < POLICY.burst; i += 1) {
        spent.push(await store.consume(bucketKey(), POLICY, now));
      }

      expect(spent.every((decision) => decision.allowed)).toBe(true);
      expect(await store.consume(bucketKey(), POLICY, now)).toMatchObject({ allowed: false });
    });

    it('gives each actor and each route class its own bucket', async () => {
      const store = createPostgresRateLimitStore(database.pool);
      const now = new Date();
      for (let i = 0; i < POLICY.burst; i += 1) await store.consume(bucketKey(), POLICY, now);

      expect(await store.consume(bucketKey({ actorId: 'child-b' }), POLICY, now)).toMatchObject({
        allowed: true,
      });
      expect(await store.consume(bucketKey({ routeClass: 'read' }), POLICY, now)).toMatchObject({
        allowed: true,
      });
    });

    /**
     * The reason this adapter exists. Two instances spending the last token at the same moment
     * must not both be allowed — the row lock, not the arithmetic, is what decides that.
     */
    it('spends a shared bucket exactly once under concurrent callers', async () => {
      const store = createPostgresRateLimitStore(database.pool);
      const now = new Date();
      const tight: RateLimitPolicy = { burst: 1, refillPerMinute: 0.0001 };

      const decisions = await Promise.all([
        store.consume(bucketKey(), tight, now),
        store.consume(bucketKey(), tight, now),
        store.consume(bucketKey(), tight, now),
      ]);

      expect(decisions.filter((decision) => decision.allowed)).toHaveLength(1);
    });
  });

  describe('idempotency record', () => {
    it('lets exactly one caller claim a key, and replays the stored response after', async () => {
      const records = createIdempotencyRepository(database.pool);

      expect(await records.claim(recordKey(), hash('a'), 60)).toEqual({ status: 'claimed' });
      expect(await records.claim(recordKey(), hash('a'), 60)).toEqual({ status: 'in-flight' });

      await records.complete(recordKey(), { statusCode: 200, body: { moves: ['one'] } });

      expect(await records.claim(recordKey(), hash('a'), 60)).toEqual({
        status: 'replay',
        response: { statusCode: 200, body: { moves: ['one'] } },
      });
    });

    /** Under a race only one insert can win; the losers must not be told they are first. */
    it('claims once under concurrent callers', async () => {
      const records = createIdempotencyRepository(database.pool);

      const claims = await Promise.all([
        records.claim(recordKey(), hash('a'), 60),
        records.claim(recordKey(), hash('a'), 60),
        records.claim(recordKey(), hash('a'), 60),
      ]);

      expect(claims.filter((claim) => claim.status === 'claimed')).toHaveLength(1);
    });

    it('refuses the same key with a different body', async () => {
      const records = createIdempotencyRepository(database.pool);
      await records.claim(recordKey(), hash('a'), 60);

      expect(await records.claim(recordKey(), hash('b'), 60)).toEqual({ status: 'mismatch' });
    });

    it('scopes a key to its actor and its route', async () => {
      const records = createIdempotencyRepository(database.pool);
      await records.claim(recordKey(), hash('a'), 60);

      expect(await records.claim(recordKey({ actorId: 'child-b' }), hash('a'), 60)).toEqual({
        status: 'claimed',
      });
      expect(
        await records.claim(recordKey({ route: 'POST /student/session' }), hash('a'), 60),
      ).toEqual({ status: 'claimed' });
    });

    /** A claim that produced nothing must not block the client's honest retry. */
    it('releases an incomplete claim so a retry can run', async () => {
      const records = createIdempotencyRepository(database.pool);
      await records.claim(recordKey(), hash('a'), 60);

      await records.release(recordKey());

      expect(await records.claim(recordKey(), hash('a'), 60)).toEqual({ status: 'claimed' });
    });

    it('does not release a claim that already has a response to replay', async () => {
      const records = createIdempotencyRepository(database.pool);
      await records.claim(recordKey(), hash('a'), 60);
      await records.complete(recordKey(), { statusCode: 200, body: { ok: true } });

      await records.release(recordKey());

      expect(await records.claim(recordKey(), hash('a'), 60)).toMatchObject({ status: 'replay' });
    });

    /** Expiry is the database's, not the caller's: a server with a fast clock cannot age a row. */
    it('treats an expired record as absent and reaps it', async () => {
      const records = createIdempotencyRepository(database.pool);
      await records.claim(recordKey(), hash('a'), -1);

      expect(await records.deleteExpired(new Date())).toBe(1);
      expect(await records.claim(recordKey(), hash('a'), 60)).toEqual({ status: 'claimed' });
    });
  });
});
