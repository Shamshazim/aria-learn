import { readConfigOrExit } from '@/config';
import { closePool, createPool, verifyConnection } from '@/db';
import { createLogger } from '@/lib/logger';
import { buildPhase1Report, formatPhase1Report } from '@/observability/report/phase1.report';
import { createPhase1MetricsRepository } from '@/repositories/phase1-metrics.repository';

const config = readConfigOrExit();
const logger = createLogger({ level: config.logLevel });
const pool = createPool(config.database, logger);

try {
  await verifyConnection(pool);
  const data = await createPhase1MetricsRepository(pool).load();
  process.stdout.write(`${formatPhase1Report(buildPhase1Report(data))}\n`);
} finally {
  await closePool(pool, logger);
}
