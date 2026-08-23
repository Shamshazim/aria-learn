import { Pool } from 'pg';

import type { DatabaseConfig } from '@/config';
import { ServiceUnavailableError } from '@/errors';
import type { Logger } from '@/lib/logger';

import type { PoolConfig } from 'pg';

/**
 * The connection pool, created once by the composition root and injected from there.
 *
 * It is deliberately not a module-level singleton (CODE-STANDARDS §4): a test that wants its
 * own throwaway database has to be able to build a second pool without fighting a global.
 */
const APPLICATION_NAME = 'aria-api';

export function createPool(config: DatabaseConfig, logger: Logger): Pool {
  const options: PoolConfig = {
    connectionString: config.url,
    max: config.poolMax,
    idleTimeoutMillis: config.idleTimeoutMs,
    connectionTimeoutMillis: config.connectionTimeoutMs,
    // Enforced by Postgres rather than by us, so a runaway query is killed even if the
    // request that started it has already gone away.
    statement_timeout: config.statementTimeoutMs,
    // Shows up in pg_stat_activity, which is how a DBA tells our connections from anyone
    // else's during an incident.
    application_name: APPLICATION_NAME,
  };

  const pool = new Pool(options);

  // An error on an *idle* client is emitted here and nowhere else. Without this listener
  // Node treats it as an unhandled 'error' event and takes the process down — a database
  // restart would become an outage instead of a reconnect.
  pool.on('error', (error) => {
    logger.error({ err: error }, 'Idle database client errored');
  });

  return pool;
}

/**
 * Proves the pool can reach Postgres. Called at boot so an unreachable database stops the
 * process there, with a message, rather than surfacing on a child's first request.
 */
export async function verifyConnection(pool: Pool): Promise<void> {
  try {
    await pool.query('SELECT 1');
  } catch (error) {
    throw new ServiceUnavailableError('database connection check failed', error);
  }
}

/** Drains the pool during shutdown. Never throws: a failure here must not mask the exit. */
export async function closePool(pool: Pool, logger: Logger): Promise<void> {
  try {
    await pool.end();
    logger.info('Database pool closed');
  } catch (error) {
    logger.error({ err: error }, 'Database pool failed to close cleanly');
  }
}
