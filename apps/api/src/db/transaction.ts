import { mapDatabaseError } from './errors';

import type { TransactionalQueryable } from './types';
import type { Pool, PoolClient } from 'pg';

/**
 * The only place `BEGIN`, `COMMIT` and `ROLLBACK` are written.
 *
 * Two entry points, one body. Most callers have a pool and want a connection borrowed for the
 * duration; the migration runner already holds a session (it is carrying an advisory lock on
 * it) and must not be handed a different one. Both funnel into `runInTransaction`, so there is
 * still exactly one implementation of the transaction envelope.
 */
export async function withTransaction<T>(
  pool: Pool,
  fn: (tx: TransactionalQueryable) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    return await runInTransaction(client, fn);
  } finally {
    // Always released, including when the rollback itself failed. A leaked connection is
    // worse than the error that leaked it: it takes the pool down a few requests later.
    client.release();
  }
}

/** For a caller that already owns a client and is responsible for releasing it. */
export async function withClientTransaction<T>(
  client: PoolClient,
  fn: (tx: TransactionalQueryable) => Promise<T>,
): Promise<T> {
  return runInTransaction(client, fn);
}

/**
 * The envelope maps *its own* failures — a BEGIN or COMMIT that the driver rejected — and
 * nothing else. An error raised inside the callback belongs to the caller and is re-thrown
 * exactly as it was: a `NotFoundError` thrown mid-transaction has to stay a 404, and a bug
 * has to keep its own message rather than arriving as a generic database failure.
 */
async function runInTransaction<T>(
  client: PoolClient,
  fn: (tx: TransactionalQueryable) => Promise<T>,
): Promise<T> {
  try {
    await client.query('BEGIN');
  } catch (error) {
    throw mapDatabaseError(error, 'transaction.begin');
  }

  let result: T;
  try {
    result = await fn(client);
  } catch (error) {
    await rollbackQuietly(client);
    throw error;
  }

  try {
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await rollbackQuietly(client);
    throw mapDatabaseError(error, 'transaction.commit');
  }
}

/**
 * A rollback can fail when the connection is already gone. That failure is not the one worth
 * reporting — the original is — so it is swallowed here and the caller re-throws that.
 */
async function rollbackQuietly(client: PoolClient): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } catch {
    // Intentionally ignored: the connection is unusable and `release()` will discard it.
  }
}
