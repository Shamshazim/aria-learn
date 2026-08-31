import { createSupabaseDirectory } from '@/auth';
import { loadRepoEnvFile, readConfigOrExit } from '@/config';
import { closePool, createPool } from '@/db';
import { systemClock } from '@/lib/clock';
import { uuidGenerator } from '@/lib/ids';
import { createLogger } from '@/lib/logger';
import { createConsentRecordRepository } from '@/repositories/consent-record.repository';
import { createDeletionRequestRepository } from '@/repositories/deletion-request.repository';
import { createParentRepository } from '@/repositories/parent.repository';
import { createStudentRepository } from '@/repositories/student.repository';
import { createDeletionService } from '@/services/parent/deletion.service';

/**
 * `npm run identity:replay-deletions -w @aria/api`.
 *
 * Finishes every erasure that stopped part-way (P0-28). A deletion touches our database and
 * the identity provider, and nothing can make those two atomic — so the ledger records how
 * far each one got and this picks them up.
 *
 * Safe to run repeatedly, and meant to be: a row that is already complete is one the query
 * does not return. Run it on a schedule, and after any provider outage.
 */
async function main(): Promise<void> {
  loadRepoEnvFile();
  const config = readConfigOrExit();
  const logger = createLogger({ level: config.logLevel });
  const auth = config.auth;

  if (auth?.serviceRoleKey === undefined) {
    // Exiting rather than running: without the key every provider call fails, and a run that
    // only increments failure counters makes the ledger look worse than it is.
    process.stderr.write(
      'SUPABASE_SERVICE_ROLE_KEY is not set, so provider users cannot be deleted.\n',
    );
    process.exitCode = 1;
    return;
  }

  const pool = createPool(config.database, logger);

  try {
    const service = createDeletionService({
      ledger: createDeletionRequestRepository(pool),
      students: createStudentRepository({ db: pool, ids: uuidGenerator }),
      parents: createParentRepository({ db: pool, ids: uuidGenerator }),
      consents: createConsentRecordRepository(pool),
      directory: createSupabaseDirectory({ auth, serviceRoleKey: auth.serviceRoleKey }),
      clock: systemClock,
      ids: uuidGenerator,
      logger,
    });

    const outcome = await service.replay();
    logger.info(outcome, 'Deletion replay finished');
    // A non-zero exit when anything is still owed, so a scheduler notices rather than a human
    // having to read a log to find out that erasures are piling up.
    if (outcome.failed > 0) process.exitCode = 1;
  } finally {
    await closePool(pool, logger);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
