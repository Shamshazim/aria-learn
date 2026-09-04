import { z } from 'zod';

import { runQuery } from '@/db/run-query';
import { withTransaction } from '@/db/transaction';
import type { Queryable, DbRow } from '@/db/types';
import { consume, fullBucket, type BucketState } from '@/services/rate-limit/token-bucket';
import type {
  RateLimitDecision,
  RateLimitKey,
  RateLimitPolicy,
  RateLimitStore,
} from '@/types/rate-limit';

import type { Pool } from 'pg';

/**
 * Bucket state in Postgres, for a deployment running more than one API instance (X-05).
 *
 * The memory adapter grants its whole limit per process, so three instances mean three times
 * the traffic before anything is refused. That is a fine ceiling for a runaway loop and the
 * wrong answer where the number has to mean something.
 *
 * It spends inside a transaction, holding a row lock, and does the arithmetic in TypeScript
 * with the very functions the memory adapter uses. The obvious alternative — one clever
 * `INSERT … ON CONFLICT DO UPDATE` with the refill inlined in SQL — was tried and rejected:
 * it cannot report whether it spent without a second reading of the same expression, and it
 * would be a second, subtly different implementation of the limit for a reviewer to keep in
 * step with the first.
 */
const rowSchema = z.object({ tokens: z.number(), updated_at: z.date() });
type BucketRow = DbRow & z.infer<typeof rowSchema>;

export function createPostgresRateLimitStore(pool: Pool): RateLimitStore {
  return {
    consume: (key, policy, now) => spend(pool, key, policy, now),
  };
}

/**
 * `now` is accepted and then ignored in favour of the database's own clock.
 *
 * The signature keeps the port honest — the memory adapter genuinely needs to be told the
 * time — but a bucket compared against one server's clock and written against another's is a
 * bucket an instance with a fast clock can mint tokens from. Both readings come from
 * Postgres, so a clock jump moves them together (X-05 "clock jumps on the server").
 */
async function spend(
  pool: Pool,
  key: RateLimitKey,
  policy: RateLimitPolicy,
  _now: Date,
): Promise<RateLimitDecision> {
  return withTransaction(pool, async (tx) => {
    const at = await databaseNow(tx);
    const state = await lockBucket(tx, key, policy, at);
    const { decision, next } = consume(state, policy, at);

    await write(tx, key, next);
    return decision;
  });
}

/**
 * Materialise the row, then lock it.
 *
 * `INSERT … ON CONFLICT DO NOTHING` first, because `SELECT … FOR UPDATE` cannot lock a row
 * that does not exist yet: without it, two instances meeting a brand-new actor would both
 * find nothing, both start from a full bucket, and both spend the same token.
 *
 * The row is seeded *full*. Seeding it empty would make an actor's very first request the one
 * that gets refused, which is the opposite of what a burst allowance is for.
 */
async function lockBucket(
  db: Queryable,
  key: RateLimitKey,
  policy: RateLimitPolicy,
  at: Date,
): Promise<BucketState> {
  await runQuery({
    db,
    operation: 'rateLimit.ensureBucket',
    sql: `INSERT INTO rate_limit_bucket (actor_class, actor_id, route_class, tokens, updated_at)
          VALUES ($1, $2, $3, $4, now())
          ON CONFLICT (actor_class, actor_id, route_class) DO NOTHING`,
    params: [key.actorClass, key.actorId, key.routeClass, policy.burst],
  });

  const result = await runQuery<BucketRow>({
    db,
    operation: 'rateLimit.lockBucket',
    sql: `SELECT tokens, updated_at FROM rate_limit_bucket
          WHERE actor_class = $1 AND actor_id = $2 AND route_class = $3
          FOR UPDATE`,
    params: [key.actorClass, key.actorId, key.routeClass],
  });

  const row = result.rows[0];
  // The insert above guarantees a row. Treating its absence as a full bucket keeps the
  // function total rather than asserting, and fails open — a limiter that throws is a
  // limiter that takes the whole route down with it.
  if (row === undefined) return fullBucket(policy, at);

  const parsed = rowSchema.parse(row);
  return { tokens: parsed.tokens, updatedAt: parsed.updated_at };
}

async function write(db: Queryable, key: RateLimitKey, state: BucketState): Promise<void> {
  await runQuery({
    db,
    operation: 'rateLimit.write',
    sql: `UPDATE rate_limit_bucket SET tokens = $4, updated_at = now()
          WHERE actor_class = $1 AND actor_id = $2 AND route_class = $3`,
    params: [key.actorClass, key.actorId, key.routeClass, state.tokens],
  });
}

async function databaseNow(db: Queryable): Promise<Date> {
  const result = await runQuery<DbRow & { now: Date }>({
    db,
    operation: 'rateLimit.now',
    sql: 'SELECT now() AS now',
  });
  return z.object({ now: z.date() }).parse(result.rows[0]).now;
}
