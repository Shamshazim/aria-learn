import type { Logger } from '@/lib/logger';

import { loadMigrationFiles, MigrationError, MIGRATIONS_DIR } from './migration-files';
import { withClientTransaction } from './transaction';

import type { MigrationFile } from './migration-files';
import type { Queryable } from './types';
import type { Pool, PoolClient } from 'pg';

/**
 * The migration runner: ordered, idempotent, and recorded.
 *
 * Three rules it enforces, each of which exists because the alternative is a database that
 * differs between two machines and nobody can say how:
 *   1. A migration runs once. The ledger, not a file timestamp, decides.
 *   2. A migration already applied may never change. Checksums are compared every run.
 *   3. A migration may never appear *behind* one that has already run. Two branches that both
 *      add `007` are caught here rather than in production.
 */

/**
 * The ledger is created by the runner rather than by `001`, because a migration cannot record
 * itself in a table that does not exist yet. `IF NOT EXISTS` makes the bootstrap idempotent.
 */
const CREATE_LEDGER = `
  CREATE TABLE IF NOT EXISTS schema_migration (
    version    TEXT        PRIMARY KEY,
    name       TEXT        NOT NULL,
    checksum   TEXT        NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

/**
 * A session-level advisory lock, so two API instances starting at once cannot both apply the
 * same migration. The number is arbitrary but fixed: it only has to be ours and stay ours.
 */
const MIGRATION_LOCK_KEY = '541039802147';

export type AppliedMigration = { version: string; name: string; checksum: string };

export type MigrationOutcome = {
  applied: readonly string[];
  skipped: number;
};

export type MigrateDeps = {
  pool: Pool;
  logger: Logger;
  dir?: string;
};

export async function runMigrations({
  pool,
  logger,
  dir = MIGRATIONS_DIR,
}: MigrateDeps): Promise<MigrationOutcome> {
  const files = await loadMigrationFiles(dir);
  const client = await pool.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    await client.query(CREATE_LEDGER);

    const applied = await readLedger(client);
    const pending = planMigrations(files, applied);

    if (pending.length === 0) {
      logger.info({ alreadyApplied: applied.length }, 'Database schema is up to date');
      return { applied: [], skipped: applied.length };
    }

    for (const file of pending) {
      await applyMigration(client, file, logger);
    }

    return { applied: pending.map((file) => file.version), skipped: applied.length };
  } finally {
    // Released before the client goes back to the pool: a session-level lock outlives the
    // transaction, so a pooled connection would carry it to the next borrower.
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
    client.release();
  }
}

async function readLedger(db: Queryable): Promise<AppliedMigration[]> {
  const { rows } = await db.query<{ version: string; name: string; checksum: string }>(
    'SELECT version, name, checksum FROM schema_migration ORDER BY version',
  );
  return rows.map((row) => ({ version: row.version, name: row.name, checksum: row.checksum }));
}

/**
 * Decides what to run. Pure, so every rule above is covered by a unit test that needs no
 * database at all — which is the only reason those rules are actually tested.
 */
export function planMigrations(
  files: readonly MigrationFile[],
  applied: readonly AppliedMigration[],
): MigrationFile[] {
  const byVersion = new Map(applied.map((record) => [record.version, record]));
  const onDisk = new Set(files.map((file) => file.version));

  for (const record of applied) {
    if (!onDisk.has(record.version)) {
      throw new MigrationError(
        `Migration ${record.version} (${record.name}) is recorded as applied but is no longer ` +
          'on disk. Migrations are forward-only and are never deleted.',
      );
    }
  }

  for (const file of files) {
    const record = byVersion.get(file.version);
    if (record && record.checksum !== file.checksum) {
      throw new MigrationError(
        `Migration ${file.filename} changed after it was applied. Migrations are never edited ` +
          'once merged — add a new one that alters what this one created.',
      );
    }
  }

  const pending = files.filter((file) => !byVersion.has(file.version));
  assertInOrder(pending, applied);
  return pending;
}

/**
 * Refuses a migration numbered below one that already ran. Applying it would produce a
 * database whose final shape depends on the order two branches happened to merge in.
 */
function assertInOrder(
  pending: readonly MigrationFile[],
  applied: readonly AppliedMigration[],
): void {
  const highestApplied = applied.at(-1)?.version;
  if (!highestApplied) return;

  const outOfOrder = pending.find((file) => file.version.localeCompare(highestApplied) < 0);
  if (outOfOrder) {
    throw new MigrationError(
      `Migration ${outOfOrder.filename} is pending but ${highestApplied} has already been ` +
        'applied. Renumber it above the highest applied version and re-run.',
    );
  }
}

/**
 * One migration, one transaction. Postgres does transactional DDL, so a migration that fails
 * halfway leaves nothing behind — including its ledger row, which is written inside the same
 * transaction precisely so the two can never disagree.
 */
async function applyMigration(
  client: PoolClient,
  file: MigrationFile,
  logger: Logger,
): Promise<void> {
  const startedAt = Date.now();

  await withClientTransaction(client, async (tx) => {
    await tx.query(file.sql);
    await tx.query('INSERT INTO schema_migration (version, name, checksum) VALUES ($1, $2, $3)', [
      file.version,
      file.name,
      file.checksum,
    ]);
  });

  // `migration`, not `name`: the logger redacts `*.name` on purpose — it is usually a child's
  // — and a migration should not have to be the exception that weakens that rule.
  logger.info(
    { version: file.version, migration: file.name, durationMs: Date.now() - startedAt },
    'Applied migration',
  );
}
