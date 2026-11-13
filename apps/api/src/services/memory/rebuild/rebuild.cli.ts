import { loadRepoEnvFile, readConfig } from '@/config';
import { createInventoryService } from '@/curriculum';
import { closePool, createPool } from '@/db';
import { systemClock } from '@/lib/clock';
import { uuidGenerator } from '@/lib/ids';
import { createLogger } from '@/lib/logger';
import { createConsolidationHistoryRepository } from '@/repositories/consolidation-history.repository';
import { createFactCorrectionRepository } from '@/repositories/fact-correction.repository';
import { createLearnerEpisodeRepository } from '@/repositories/learner-episode.repository';
import { createLearnerMemoryRepository } from '@/repositories/learner-memory.repository';
import { createMemoryShadowRepository } from '@/repositories/memory-shadow.repository';
import { createSessionEventRepository } from '@/repositories/session-event.repository';
import { createRebuildService } from '@/services/memory/rebuild/rebuild.service';

/**
 * `npm run memory:rebuild -w @aria/api -- --student <id>` or `-- --all`
 *
 * Re-derives a child's memory from the raw log into the shadow tables and prints the drift
 * against live memory. Writes nothing live. There is no scheduler on purpose: cron or CI runs
 * this, and promoting a shadow set is a separate, manual, logged decision.
 */
async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const student = argv[argv.indexOf('--student') + 1];
  const all = argv.includes('--all');
  if (!all && (!argv.includes('--student') || student === undefined)) {
    throw new Error('Usage: memory:rebuild -- --student <id> | --all');
  }
  loadRepoEnvFile();
  const config = readConfig();
  const logger = createLogger({ level: config.logLevel });
  const pool = createPool(config.database, logger);
  const ids = uuidGenerator;
  const inventory = createInventoryService();
  const service = createRebuildService({
    pool,
    events: createSessionEventRepository({ db: pool, ids, clock: systemClock }),
    history: createConsolidationHistoryRepository(pool),
    memory: createLearnerMemoryRepository({ db: pool, ids }),
    episodes: createLearnerEpisodeRepository({ db: pool, ids }),
    corrections: createFactCorrectionRepository({ db: pool, ids }),
    shadow: createMemoryShadowRepository(pool),
    ids,
    clock: systemClock,
    repetitionsForDurableFact: config.memoryRepetitionsForDurableFact,
    skillName: (code) => inventory.getSkill(code)?.name ?? null,
  });
  try {
    const results = all
      ? await service.rebuildAll()
      : [{ studentId: student ?? '', ...(await service.rebuild(student ?? '')) }];
    process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
  } finally {
    await closePool(pool, logger);
  }
}

await main();
