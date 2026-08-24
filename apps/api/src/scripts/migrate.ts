import { readConfig } from '@/config';
import { closePool, createPool, runMigrations } from '@/db';
import { createLogger } from '@/lib/logger';

/**
 * `npm run db:migrate -w @aria/api`.
 *
 * A separate entry point from the runner it calls, for the same reason `index.ts` is separate
 * from `server.ts`: importing `migrate.ts` must not connect to anything. This file is the only
 * part that reads the environment, exits, and is allowed to have side effects.
 */
async function main(): Promise<void> {
  const config = readConfig();
  const logger = createLogger({ level: config.logLevel });
  const pool = createPool(config.database, logger);

  try {
    const outcome = await runMigrations({ pool, logger });
    logger.info(
      { applied: outcome.applied, alreadyApplied: outcome.skipped },
      outcome.applied.length > 0 ? 'Migrations applied' : 'Nothing to apply',
    );
  } finally {
    await closePool(pool, logger);
  }
}

main().catch((error: unknown) => {
  // Not the logger: a migration failure has to be legible even when logging is the thing
  // misconfigured, and the exit code is what a deploy pipeline actually reads.
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
