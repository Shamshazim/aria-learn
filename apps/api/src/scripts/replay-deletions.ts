import { readConfig } from '@/config';
import { closePool, createPool } from '@/db';
import { createIdentityRuntime } from '@/identity.runtime';
import { systemClock } from '@/lib/clock';
import { uuidGenerator } from '@/lib/ids';
import { createLogger } from '@/lib/logger';

/**
 * `npm run identity:replay-deletions -w @aria/api`.
 *
 * The other half of "delete means delete". A deletion that got as far as removing Aria's rows
 * but not the vendor's leaves a durable ledger row; so does a restore from backup, which can
 * bring deleted rows back. Both are finished by running this, and running it twice is safe —
 * every step it takes is idempotent.
 *
 * A separate entry point rather than a boot task on purpose: an operator chooses when a
 * restore is reconciled, and a deploy that silently re-ran deletions would be worse than one
 * that waited to be told.
 */
async function main(): Promise<void> {
  const config = readConfig();
  const logger = createLogger({ level: config.logLevel });
  const pool = createPool(config.database, logger);

  try {
    const identity = createIdentityRuntime({
      pool,
      config,
      ids: uuidGenerator,
      clock: systemClock,
      logger,
      fetch: globalThis.fetch,
    });

    const settled = await identity.deletion.replayPending();
    const unfinished = settled.filter((request) => request.stage !== 'complete');

    // Ids and counts only. The subject of a deletion is exactly the person whose identifiers
    // must not be written to a log (CODE-STANDARDS §5).
    logger.info(
      { replayed: settled.length, unfinished: unfinished.map((request) => request.id) },
      unfinished.length > 0 ? 'Some deletions are still pending' : 'All deletions are complete',
    );
    if (unfinished.length > 0) process.exitCode = 1;
  } finally {
    await closePool(pool, logger);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
