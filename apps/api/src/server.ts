import { AiConfigError, loadAiConfig } from '@/ai/provider';
import { createAiRuntime } from '@/ai/runtime';
import { createApp } from '@/app';
import { readConfigOrExit } from '@/config';
import { createInventoryService } from '@/curriculum';
import { closePool, createPool, verifyConnection } from '@/db';
import { systemClock } from '@/lib/clock';
import { uuidGenerator } from '@/lib/ids';
import { createLogger } from '@/lib/logger';
import type { Logger } from '@/lib/logger';

import type { Server } from 'node:http';
import type { Pool } from 'pg';

/**
 * Owns the socket, the pool and the process lifecycle. `app.ts` owns the application.
 *
 * Configuration is loaded before anything else, and the database is proven reachable before
 * the port opens, so a broken deployment stops here — never later, in front of a child.
 */
export async function start(): Promise<void> {
  const aiConfig = readAiConfigOrExit();
  const config = readConfigOrExit();
  // Authored graph defects must stop boot before the API can serve curriculum.
  createInventoryService();
  const logger = createLogger({ level: config.logLevel });

  const pool = createPool(config.database, logger);
  await verifyConnectionOrExit(pool, logger);

  let ai: Awaited<ReturnType<typeof createAiRuntime>>;
  try {
    ai = await createAiRuntime({
      aiConfig,
      appConfig: config,
      db: pool,
      ids: uuidGenerator,
      clock: systemClock,
      logger,
      fetch: globalThis.fetch,
    });
  } catch (error) {
    logger.fatal({ err: error }, 'AI endpoint startup checks failed; refusing to start');
    await closePool(pool, logger);
    throw error;
  }

  const app = createApp({
    config,
    logger,
    clock: systemClock,
    ids: uuidGenerator,
    statusService: ai.status,
  });
  const server = app.listen(config.port, () => {
    logger.info({ port: config.port, env: config.env }, 'API listening');
  });

  installShutdownHandlers({
    server,
    logger,
    timeoutMs: config.shutdownTimeoutMs,
    onDrained: () => closePool(pool, logger),
  });
}

function readAiConfigOrExit(): ReturnType<typeof loadAiConfig> {
  try {
    return loadAiConfig(process.env);
  } catch (error) {
    if (error instanceof AiConfigError) {
      process.stderr.write(`${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }
}

/** A database the process cannot reach is a failed boot, not a degraded service. */
async function verifyConnectionOrExit(pool: Pool, logger: Logger): Promise<void> {
  try {
    await verifyConnection(pool);
    logger.info('Database reachable');
  } catch (error) {
    logger.fatal({ err: error }, 'Cannot reach the database; refusing to start');
    await closePool(pool, logger);
    process.exit(1);
  }
}

type ShutdownDeps = {
  server: Server;
  logger: Logger;
  timeoutMs: number;
  /** Runs once the socket has drained, before the process exits. Must not throw. */
  onDrained: () => Promise<void>;
};

/**
 * SIGTERM stops new connections, lets in-flight requests finish, releases the pool, then
 * exits 0.
 *
 * The timer is the safety net: a request that never completes must not hold a deploy open
 * forever, so a drain that overruns exits non-zero rather than hanging.
 */
export function installShutdownHandlers({
  server,
  logger,
  timeoutMs,
  onDrained,
}: ShutdownDeps): void {
  let shuttingDown = false;

  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down');

    const timer = setTimeout(() => {
      logger.error({ timeoutMs }, 'Drain timed out; exiting');
      process.exit(1);
    }, timeoutMs);
    timer.unref();

    server.close((error) => {
      clearTimeout(timer);
      void finish(error, logger, onDrained);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

async function finish(
  error: Error | undefined,
  logger: Logger,
  onDrained: () => Promise<void>,
): Promise<void> {
  await onDrained();

  if (error) {
    logger.error({ err: error }, 'Shutdown failed');
    process.exit(1);
  }

  logger.info('Shutdown complete');
  process.exit(0);
}
