import { createApp } from '@/app';
import { ConfigError, loadConfig } from '@/config';
import type { AppConfig } from '@/config';
import { systemClock } from '@/lib/clock';
import { uuidGenerator } from '@/lib/ids';
import { createLogger } from '@/lib/logger';
import type { Logger } from '@/lib/logger';

import type { Server } from 'node:http';

/**
 * Owns the socket and the process lifecycle. `app.ts` owns the application.
 *
 * Configuration is loaded before anything else so a missing variable stops the process here,
 * with a message naming it — never later, in front of a child.
 */
const VERSION = process.env.npm_package_version ?? '0.0.0';

export function start(): void {
  const config = readConfigOrExit();
  const logger = createLogger({ level: config.logLevel });

  const app = createApp({ config, logger, clock: systemClock, ids: uuidGenerator });
  const server = app.listen(config.port, () => {
    logger.info({ port: config.port, env: config.env }, 'API listening');
  });

  installShutdownHandlers({ server, logger, timeoutMs: config.shutdownTimeoutMs });
}

function readConfigOrExit(): AppConfig {
  try {
    return loadConfig(process.env, VERSION);
  } catch (error) {
    if (error instanceof ConfigError) {
      // Deliberately not the logger: configuration failed, so the logger's own settings are
      // exactly what we cannot trust yet.
      process.stderr.write(`${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }
}

type ShutdownDeps = {
  server: Server;
  logger: Logger;
  timeoutMs: number;
};

/**
 * SIGTERM stops new connections, lets in-flight requests finish, then exits 0.
 *
 * The timer is the safety net: a request that never completes must not hold a deploy open
 * forever, so a drain that overruns exits non-zero rather than hanging.
 */
export function installShutdownHandlers({ server, logger, timeoutMs }: ShutdownDeps): void {
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
      if (error) {
        logger.error({ err: error }, 'Shutdown failed');
        process.exit(1);
      }
      logger.info('Shutdown complete');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
