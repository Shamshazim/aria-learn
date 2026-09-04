import { z } from 'zod';

import { runQuery } from '@/db/run-query';
import type { DbRow, Queryable } from '@/db/types';
import type {
  IdempotencyClaim,
  IdempotencyKey,
  IdempotencyRepository,
  StoredResponse,
} from '@/types/idempotency';

/**
 * The record of a request that already happened (X-05).
 *
 * The claim is one statement. `INSERT … ON CONFLICT DO NOTHING RETURNING` tells us in a single
 * round trip whether we are the first attempt: a row comes back when we inserted it and
 * nothing when somebody else holds the key. Read-then-insert would leave a window in which two
 * copies of the same tap both decide they are first, which is the entire failure being
 * prevented.
 */
const existingSchema = z.object({
  request_hash: z.string(),
  status_code: z.number().int().nullable(),
  response_body: z.unknown().nullable(),
});
type ExistingRow = DbRow & z.infer<typeof existingSchema>;

export function createIdempotencyRepository(db: Queryable): IdempotencyRepository {
  return {
    claim: (key, requestHash, ttlSeconds) => claim(db, key, requestHash, ttlSeconds),
    complete: (key, response) => complete(db, key, response),
    release: (key) => release(db, key),
    deleteExpired: (now) => deleteExpired(db, now),
  };
}

async function claim(
  db: Queryable,
  key: IdempotencyKey,
  requestHash: string,
  ttlSeconds: number,
): Promise<IdempotencyClaim> {
  const inserted = await runQuery<DbRow>({
    db,
    operation: 'idempotency.claim',
    sql: `INSERT INTO idempotency_record
            (key, actor_class, actor_id, route, request_hash, expires_at)
          VALUES ($1, $2, $3, $4, $5, now() + make_interval(secs => $6))
          ON CONFLICT (actor_class, actor_id, route, key) DO NOTHING
          RETURNING key`,
    params: [key.key, key.actorClass, key.actorId, key.route, requestHash, ttlSeconds],
  });

  if (inserted.rows.length > 0) return { status: 'claimed' };

  const existing = await load(db, key);
  // Expired between the insert and this read: the reaper removed it, and the honest answer is
  // to let the caller retry rather than to invent a claim we do not hold.
  if (existing === null) return { status: 'in-flight' };
  if (existing.request_hash !== requestHash) return { status: 'mismatch' };
  if (existing.status_code === null) return { status: 'in-flight' };

  return {
    status: 'replay',
    response: { statusCode: existing.status_code, body: existing.response_body },
  };
}

async function load(db: Queryable, key: IdempotencyKey): Promise<ExistingRow | null> {
  const result = await runQuery<ExistingRow>({
    db,
    operation: 'idempotency.load',
    sql: `SELECT request_hash, status_code, response_body FROM idempotency_record
          WHERE actor_class = $1 AND actor_id = $2 AND route = $3 AND key = $4
            AND expires_at > now()`,
    params: [key.actorClass, key.actorId, key.route, key.key],
  });

  const row = result.rows[0];
  if (row === undefined) return null;

  existingSchema.parse(row);
  return row;
}

async function complete(
  db: Queryable,
  key: IdempotencyKey,
  response: StoredResponse,
): Promise<void> {
  await runQuery({
    db,
    operation: 'idempotency.complete',
    sql: `UPDATE idempotency_record
          SET status_code = $5, response_body = $6, completed_at = now()
          WHERE actor_class = $1 AND actor_id = $2 AND route = $3 AND key = $4`,
    params: [
      key.actorClass,
      key.actorId,
      key.route,
      key.key,
      response.statusCode,
      JSON.stringify(response.body ?? null),
    ],
  });
}

async function release(db: Queryable, key: IdempotencyKey): Promise<void> {
  await runQuery({
    db,
    operation: 'idempotency.release',
    sql: `DELETE FROM idempotency_record
          WHERE actor_class = $1 AND actor_id = $2 AND route = $3 AND key = $4
            AND status_code IS NULL`,
    params: [key.actorClass, key.actorId, key.route, key.key],
  });
}

/**
 * Reaping is a delete, not a flag. A row here is a hash and a response body that belonged to a
 * child's request; keeping it past the retry it exists for would make this a log of what they
 * did, which P0-23 says it must not become.
 */
async function deleteExpired(db: Queryable, now: Date): Promise<number> {
  const result = await runQuery({
    db,
    operation: 'idempotency.deleteExpired',
    sql: 'DELETE FROM idempotency_record WHERE expires_at <= $1',
    params: [now],
  });
  return result.rowCount ?? 0;
}
