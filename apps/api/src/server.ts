import { AiConfigError, loadAiConfig } from '@/ai/provider';
import { createAiRuntime } from '@/ai/runtime';
import { createApp } from '@/app';
import { loadRepoEnvFile, readConfigOrExit } from '@/config';
import type { AppConfig } from '@/config';
import { createInventoryService } from '@/curriculum';
import { closePool, createPool, runMigrations, verifyConnection } from '@/db';
import { systemClock } from '@/lib/clock';
import { uuidGenerator } from '@/lib/ids';
import { createLogger } from '@/lib/logger';
import type { Logger } from '@/lib/logger';
import { createMetrics } from '@/observability/metrics';
import type { Metrics } from '@/observability/metrics';
import { createPhase1Runtime } from '@/phase1/runtime';
import { createPhase2Runtime } from '@/phase2/runtime';
import { createIdempotencyRepository } from '@/repositories/idempotency.repository';
import { createPostgresRateLimitStore } from '@/repositories/rate-limit.repository';
import { createVoiceSessionRepository } from '@/repositories/voice-session.repository';
import { createSegmentBus } from '@/services/content/segment-bus';

import type { Server } from 'node:http';
import type { Pool } from 'pg';

/**
 * Owns the socket, the pool and the process lifecycle. `app.ts` owns the application.
 *
 * Configuration is loaded before anything else, and the database is proven reachable before
 * the port opens, so a broken deployment stops here — never later, in front of a child.
 */
export async function start(): Promise<void> {
  // First, before anything reads `process.env`: the AI endpoints are checked before the app's
  // own configuration is, and they would otherwise only see what the shell exported.
  loadRepoEnvFile();
  const aiConfig = readAiConfigOrExit();
  const config = readConfigOrExit();
  // Authored graph defects must stop boot before the API can serve curriculum.
  createInventoryService();
  const logger = createLogger({ level: config.logLevel });

  const pool = createPool(config.database, logger);
  await verifyConnectionOrExit(pool, logger);
  await runMigrations({ pool, logger });

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

  const runtimeDeps = createRuntimeDeps({ pool, ai, config, logger, metrics: createMetrics() });
  const phase1 = await createPhase1Runtime(runtimeDeps);
  const voice = config.voice === undefined ? undefined : createPhase2Runtime(runtimeDeps, phase1);
  const identity = phase1.identity.routerDeps(voice?.consent);
  const app = composeApp({ config, logger, ai, pool, phase1, identity, voice });
  const stopSweeper = startIdleSweeper(phase1.identity.expiry, logger);
  const server = app.listen(config.port, () => {
    logger.info({ port: config.port, env: config.env }, 'API listening');
  });

  installShutdownHandlers({
    server,
    logger,
    timeoutMs: config.shutdownTimeoutMs,
    onDrained: async () => {
      stopSweeper();
      await closePool(pool, logger);
    },
  });
}

/**
 * The app, and the two stores X-05 added to it.
 *
 * Extracted from `start` because that function is a sequence of boot steps and this is one of
 * them; inlining it pushed `start` past the length the standards allow, which is the rule
 * doing its job rather than an obstacle to route around.
 *
 * Both stores are Postgres-backed here and in-process nowhere: a deployment runs more than one
 * instance, and a rate limit or a replay record that only one of them can see is a promise the
 * others do not keep.
 */
function composeApp(
  input: Readonly<{
    config: AppConfig;
    logger: Logger;
    ai: Awaited<ReturnType<typeof createAiRuntime>>;
    pool: Pool;
    phase1: Awaited<ReturnType<typeof createPhase1Runtime>>;
    identity: ReturnType<Awaited<ReturnType<typeof createPhase1Runtime>>['identity']['routerDeps']>;
    voice: ReturnType<typeof createPhase2Runtime> | undefined;
  }>,
): ReturnType<typeof createApp> {
  const { config, logger, ai, pool, phase1, identity, voice } = input;
  return createApp({
    config,
    logger,
    clock: systemClock,
    ids: uuidGenerator,
    statusService: ai.status,
    rateLimitStore: createPostgresRateLimitStore(pool),
    idempotency: createIdempotencyRepository(pool),
    student: phase1.student,
    ...(identity === undefined ? {} : { identity }),
    ...(voice === undefined ? {} : { voice: voice.routes }),
  });
}

/**
 * P2H-12: a child who closes the tab sends no further request, so nothing would notice.
 *
 * The middleware ends an idle session the moment somebody asks with a stale cookie; this is
 * what ends the ones nobody ever asks about again. It is `unref`d, so it never holds the
 * process open, and it logs only counts.
 */
const IDLE_SWEEP_INTERVAL_MS = 5 * 60 * 1_000;

function startIdleSweeper(
  expiry: Readonly<{ sweep(): Promise<number> }>,
  logger: Logger,
): () => void {
  const timer = setInterval(() => {
    void expiry.sweep().then(
      (ended) => {
        if (ended > 0) logger.info({ ended }, 'Ended idle child sessions');
      },
      (error: unknown) => {
        logger.warn({ err: error }, 'Idle session sweep failed');
      },
    );
  }, IDLE_SWEEP_INTERVAL_MS);
  timer.unref();
  return () => {
    clearInterval(timer);
  };
}

function createRuntimeDeps(input: {
  pool: Pool;
  ai: Awaited<ReturnType<typeof createAiRuntime>>;
  config: ReturnType<typeof readConfigOrExit>;
  logger: Logger;
  metrics: Metrics;
}) {
  return {
    pool: input.pool,
    ai: input.ai.client,
    spend: input.ai.spend,
    config: input.config,
    ids: uuidGenerator,
    clock: systemClock,
    logger: input.logger,
    metrics: input.metrics,
    // P2H-07: one bus per process; a subscription lasts exactly as long as one request.
    gatedStreamer: input.ai.gatedStreamer,
    segments: createSegmentBus(),
    ...(input.config.voice === undefined
      ? {}
      : { closeVoiceSession: voiceSessionCloser(input.pool) }),
  };
}

function voiceSessionCloser(pool: Pool) {
  const sessions = createVoiceSessionRepository(pool);
  return async (sessionId: string, at: Date): Promise<void> => {
    await sessions.close(sessionId, at);
  };
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
