import { readConfig } from '@/config';
import { outputSafety } from '@/content/output-safety';
import { closePool, createPool } from '@/db';
import { createLogger } from '@/lib/logger';
import { createQualityGate } from '@/quality';
import { createContentItemRepository } from '@/repositories/content-item.repository';
import {
  createPrewarmService,
  emptyBank,
  PREWARM_TARGET,
  type ContentBank,
  type PrewarmOutcome,
} from '@/services/content/prewarm.service';

/**
 * `npm run prewarm:content -w @aria/api [-- --dry-run]`.
 *
 * Fills the shareable bank to forty checker-proven items per arithmetic skill per band. It is
 * safe to run repeatedly: the second run recognises the first run's items and inserts nothing.
 * A dry run needs no database and prints exactly what a real one would write, including the
 * skills whose parameter space is smaller than the target.
 */
async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) {
    const outcomes = await service(emptyBank()).run();
    process.stdout.write(`${JSON.stringify(summary(outcomes), null, 2)}\n`);
    return;
  }
  const config = readConfig();
  const logger = createLogger({ level: config.logLevel });
  const pool = createPool(config.database, logger);
  try {
    const outcomes = await service(bankFor(pool)).run();
    logger.info(summary(outcomes), 'Content bank pre-warmed');
  } finally {
    await closePool(pool, logger);
  }
}

function service(bank: ContentBank) {
  return createPrewarmService({ bank, gate: createQualityGate(outputSafety) });
}

function bankFor(pool: Parameters<typeof createContentItemRepository>[0]['db']): ContentBank {
  const repository = createContentItemRepository({
    db: pool,
    ids: { next: () => crypto.randomUUID() },
    clock: { now: () => new Date() },
  });
  return {
    listPrompts: (target) =>
      repository.listPrompts({ skillCode: target.skillCode, band: target.band, kind: 'question' }),
    insert: async (draft) => {
      await repository.insert(draft, null);
    },
  };
}

function summary(outcomes: readonly PrewarmOutcome[]): Readonly<Record<string, unknown>> {
  return {
    target: PREWARM_TARGET,
    inserted: outcomes.reduce((total, outcome) => total + outcome.inserted, 0),
    rejected: outcomes.reduce((total, outcome) => total + outcome.rejected, 0),
    // Named rather than counted: a skill that cannot reach forty is an authoring decision to
    // revisit, not a failure to retry.
    belowTarget: outcomes
      .filter((outcome) => outcome.exhausted)
      .map((outcome) => `${outcome.skillCode}/${outcome.band}`),
    perTarget: outcomes.map((outcome) => ({
      skill: `${outcome.skillCode}/${outcome.band}`,
      existing: outcome.existing,
      inserted: outcome.inserted,
    })),
  };
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
