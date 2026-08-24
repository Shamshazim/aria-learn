import { readConfigOrExit } from '@/config';
import { closePool, createPool, verifyConnection } from '@/db';
import { systemClock } from '@/lib/clock';
import { uuidGenerator } from '@/lib/ids';
import { createLogger } from '@/lib/logger';
import { createAiGenerationLogRepository } from '@/repositories/ai-generation-log.repository';

async function main(): Promise<void> {
  const config = readConfigOrExit();
  const logger = createLogger({ level: config.logLevel });
  const pool = createPool(config.database, logger);
  try {
    await verifyConnection(pool);
    const repository = createAiGenerationLogRepository({ db: pool, ids: uuidGenerator });
    const report = await repository.report(systemClock.now(), config.aiDailySpendCapUsd);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await closePool(pool, logger);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
