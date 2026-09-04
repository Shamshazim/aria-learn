import { databaseEnvSchema, loadRepoEnvFile, toDatabaseConfig, withoutBlanks } from '@/config';
import type { DatabaseConfig } from '@/config';
import { closePool, createPool, runMigrations } from '@/db';
import { createLogger } from '@/lib/logger';

import { MIGRATE_USAGE, parseMigrateArgs } from './migrate-args';

/**
 * `npm run db:migrate -w @aria/api -- [--url <postgres-url>] [--dry-run] [--allow-gap]`.
 *
 * A separate entry point from the runner it calls, for the same reason `index.ts` is separate
 * from `server.ts`: importing `migrate.ts` must not connect to anything. This file is the only
 * part that reads the environment, exits, and is allowed to have side effects.
 *
 * It validates only the database slice of the environment, not the whole application's. A
 * deploy migrates before the new code starts (X-01), and at that moment the release's other
 * variables are not this job's business — demanding them would make a schema change fail for
 * a reason that has nothing to do with the schema.
 *
 * The repo's `.env` is loaded first, as every other entry point does. Without it the command
 * the README documents fails on a developer's machine, where `DATABASE_URL` lives in that file
 * and nowhere else. A deploy is unaffected: there is no `.env` to find, and a variable already
 * exported still wins over one read from the file.
 */
async function main(): Promise<void> {
  loadRepoEnvFile();
  const args = parseMigrateArgs(process.argv.slice(2));
  const logger = createLogger({ level: process.env.LOG_LEVEL ?? 'info' });
  const pool = createPool(databaseConfig(args.url), logger);

  try {
    const outcome = await runMigrations({
      pool,
      logger,
      dryRun: args.dryRun,
      allowGap: args.allowGap,
    });
    report(outcome, args.dryRun, logger);
  } finally {
    await closePool(pool, logger);
  }
}

function databaseConfig(url: string | undefined): DatabaseConfig {
  const source = url === undefined ? process.env : { ...process.env, DATABASE_URL: url };
  const parsed = databaseEnvSchema.safeParse(withoutBlanks(source));

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid database configuration — ${details}`);
  }

  return toDatabaseConfig(parsed.data);
}

function report(
  outcome: Awaited<ReturnType<typeof runMigrations>>,
  dryRun: boolean,
  logger: ReturnType<typeof createLogger>,
): void {
  if (dryRun) {
    logger.info(
      { pending: outcome.pending, alreadyApplied: outcome.skipped },
      outcome.pending.length > 0 ? 'Dry run: migrations pending' : 'Dry run: nothing to apply',
    );
    return;
  }

  logger.info(
    { applied: outcome.applied, alreadyApplied: outcome.skipped },
    outcome.applied.length > 0 ? 'Migrations applied' : 'Nothing to apply',
  );
}

if (process.argv.includes('--help')) {
  process.stdout.write(`${MIGRATE_USAGE}\n`);
} else {
  main().catch((error: unknown) => {
    // Not the logger: a migration failure has to be legible even when logging is the thing
    // misconfigured, and the exit code is what a deploy pipeline actually reads.
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
