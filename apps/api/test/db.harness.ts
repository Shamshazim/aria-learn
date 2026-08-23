import { randomUUID } from 'node:crypto';

import { closePool, createPool, runMigrations } from '@/db';
import type { Queryable } from '@/db';
import { createLogger } from '@/lib/logger';

import type { Pool } from 'pg';

/**
 * A real PostgreSQL for the tests that need one.
 *
 * Every test file gets its own database, created from the same migrations the deploy runs and
 * dropped when the file finishes. Not a schema, not a shared database with cleanup: a file
 * that leaves a table behind must not be able to affect a file running beside it, and the
 * cheapest way to guarantee that is for them not to share a database at all.
 *
 * The migrations are the ones in `src/db/migrations`. Tests therefore fail when a migration
 * is wrong, which is the point — a schema nothing exercises is a schema nobody has checked.
 */
const TEST_DB_PREFIX = 'aria_test_';

/** The maintenance database. `CREATE DATABASE` cannot run from inside the database it creates. */
const MAINTENANCE_DB = 'postgres';

const silentLogger = createLogger({ level: 'silent' });

export type TestDatabase = {
  pool: Pool;
  db: Queryable;
  name: string;
  /** Empties every table except the migration ledger. Cheap enough for `beforeEach`. */
  truncateAll(): Promise<void>;
  drop(): Promise<void>;
};

/**
 * Node 22 can read a `.env` itself, so a developer who followed the README's `cp .env.example
 * .env` does not also have to export DATABASE_URL to run the tests.
 */
function loadDotEnvIfPresent(): void {
  try {
    process.loadEnvFile();
  } catch {
    // No .env, or unreadable. The environment is then expected to carry DATABASE_URL already.
  }
}

export function databaseUrl(): string | undefined {
  loadDotEnvIfPresent();
  return process.env.DATABASE_URL;
}

/**
 * Whether the database-backed suites should run.
 *
 * Absent DATABASE_URL is a developer without Postgres, and skipping is kinder than failing.
 * On CI it is a misconfiguration, and skipping would quietly turn the integration tests into
 * no-ops — so there, never skip.
 */
export function shouldSkipDatabaseTests(): boolean {
  return !databaseUrl() && process.env.CI !== 'true';
}

/** `CREATE DATABASE` takes no parameters, so the name is generated, never taken from input. */
function generateDatabaseName(): string {
  return `${TEST_DB_PREFIX}${randomUUID().replace(/-/g, '')}`;
}

function adminUrl(url: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${MAINTENANCE_DB}`;
  return parsed.toString();
}

function withDatabaseName(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

function poolConfigFor(url: string, max: number): Parameters<typeof createPool>[0] {
  return {
    url,
    poolMax: max,
    idleTimeoutMs: 1_000,
    connectionTimeoutMs: 5_000,
    statementTimeoutMs: 10_000,
  };
}

export type TestDatabaseOptions = {
  /**
   * Whether to apply migrations on creation. A test of the runner itself needs an empty
   * database to run it against; everything else wants the schema already there.
   */
  migrate?: boolean;
};

export async function createTestDatabase(options: TestDatabaseOptions = {}): Promise<TestDatabase> {
  const url = databaseUrl();
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. The database tests need a PostgreSQL they may create and ' +
        'drop databases on — see the README, or `cp .env.example .env`.',
    );
  }

  const name = generateDatabaseName();
  const admin = createPool(poolConfigFor(adminUrl(url), 1), silentLogger);

  try {
    await admin.query(`CREATE DATABASE ${name}`);
  } finally {
    await closePool(admin, silentLogger);
  }

  const pool = createPool(poolConfigFor(withDatabaseName(url, name), 4), silentLogger);
  if (options.migrate !== false) {
    await runMigrations({ pool, logger: silentLogger });
  }

  return {
    pool,
    db: pool,
    name,
    truncateAll: () => truncateAll(pool),
    drop: () => dropDatabase(url, name, pool),
  };
}

/**
 * One statement, no string building: `format('%I')` quotes each identifier and the table list
 * comes from the catalogue, so this stays correct as Phase 1 adds tables without anyone
 * remembering to update it.
 */
const TRUNCATE_ALL = `
  DO $$
  DECLARE tables text;
  BEGIN
    SELECT string_agg(format('%I', tablename), ', ') INTO tables
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> 'schema_migration';

    IF tables IS NOT NULL THEN
      EXECUTE 'TRUNCATE TABLE ' || tables || ' RESTART IDENTITY CASCADE';
    END IF;
  END $$;
`;

async function truncateAll(pool: Pool): Promise<void> {
  await pool.query(TRUNCATE_ALL);
}

async function dropDatabase(url: string, name: string, pool: Pool): Promise<void> {
  // Every connection has to be gone before the drop, or Postgres refuses it.
  await closePool(pool, silentLogger);

  const admin = createPool(poolConfigFor(adminUrl(url), 1), silentLogger);
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  } finally {
    await closePool(admin, silentLogger);
  }
}
