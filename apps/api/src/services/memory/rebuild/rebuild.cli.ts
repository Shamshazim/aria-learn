import { PHASE3_THRESHOLDS } from '@aria/tutor';

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
 * `npm run memory:rebuild -w @aria/api -- --student <id>` or `-- --all`, with `--report` for a
 * one-line summary against the Phase 3 drift bar (P3-08), exiting non-zero above it.
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
    if (argv.includes('--report')) report(results.map((result) => result.report.driftScore));
  } finally {
    await closePool(pool, logger);
  }
}

/** P3-08: the worst drift against the bar the Phase 3 gate holds the cohort to. */
function report(drifts: readonly number[]): void {
  const worst = drifts.length === 0 ? null : Math.max(...drifts);
  const bar = PHASE3_THRESHOLDS.maxRebuildDrift;
  process.stdout.write(
    `students=${String(drifts.length)} max_drift=${worst === null ? 'n/a' : worst.toFixed(3)} bar=${String(bar)}\n`,
  );
  if (worst === null || worst > bar) process.exitCode = 1;
}

await main();
