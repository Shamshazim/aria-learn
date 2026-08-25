import { AiConfigError, loadAiConfig } from '@/ai/provider';
import { createAiRuntime } from '@/ai/runtime';
import { createApp } from '@/app';
import { readConfigOrExit } from '@/config';
import type { AppConfig } from '@/config';
import { createInventoryService } from '@/curriculum';
import { closePool, createPool, runMigrations, verifyConnection } from '@/db';
import { createIdentityRuntime } from '@/identity.runtime';
import { systemClock } from '@/lib/clock';
import { uuidGenerator } from '@/lib/ids';
import { createLogger } from '@/lib/logger';
import type { Logger } from '@/lib/logger';
import { createPhase1Runtime } from '@/phase1/runtime';
import { createConfiguredStudentAccess } from '@/phase1/student-access.runtime';

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
  await runMigrations({ pool, logger });

  const ai = await startAiOrExit({ aiConfig, config, pool, logger });
  const app = await composeApp({ config, logger, pool, ai });

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

type AiRuntime = Awaited<ReturnType<typeof createAiRuntime>>;

/**
 * The model layer's own startup checks. A broken endpoint has to stop the boot here, before
 * the port opens, rather than surfacing on the first request a child makes.
 */
async function startAiOrExit(input: {
  aiConfig: ReturnType<typeof loadAiConfig>;
  config: AppConfig;
  pool: Pool;
  logger: Logger;
}): Promise<AiRuntime> {
  const { aiConfig, config, pool, logger } = input;

  try {
    return await createAiRuntime({
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
}

/**
 * Identity is built before the tutoring routes because they authenticate through it: the
 * child-session resolver the tutor loop uses is this runtime's (P0-28).
 */
async function composeApp(input: {
  config: AppConfig;
  logger: Logger;
  pool: Pool;
  ai: AiRuntime;
}): Promise<ReturnType<typeof createApp>> {
  const { config, logger, pool, ai } = input;
  const shared = { pool, config, ids: uuidGenerator, clock: systemClock, logger } as const;

  const identity = createIdentityRuntime({ ...shared, fetch: globalThis.fetch });

  return createApp({
    config,
    logger,
    clock: systemClock,
    ids: uuidGenerator,
    statusService: ai.status,
    identity: identity.router,
    student: await createPhase1Runtime({
      ...shared,
      ai: ai.client,
      spend: ai.spend,
      access: createConfiguredStudentAccess(config, identity.childAuth),
    }),
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
