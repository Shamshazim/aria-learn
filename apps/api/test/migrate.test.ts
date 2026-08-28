import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runMigrations } from '@/db';
import { createLogger } from '@/lib/logger';

import { createTestDatabase, shouldSkipDatabaseTests } from './db.harness';

import type { TestDatabase } from './db.harness';

/**
 * The runner against a real database. The harness has already run it once — that is how the
 * database exists — so these tests assert what that run left behind and what a second one
 * does, which is the property a deploy depends on.
 */
const suite = shouldSkipDatabaseTests() ? describe.skip : describe;

const logger = createLogger({ level: 'silent' });

suite('runMigrations', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
  }, 60_000);

  afterAll(async () => {
    await database.drop();
  });

  it('records every migration it applied', async () => {
    const { rows } = await database.pool.query<{ version: string; name: string; checksum: string }>(
      'SELECT version, name, checksum FROM schema_migration ORDER BY version',
    );

    expect(rows.map((row) => row.version)).toEqual([
      '001',
      '002',
      '003',
      '004',
      '005',
      '006',
      '007',
      '008',
      '009',
    ]);
    expect(rows[0]?.name).toBe('identity');
    expect(rows[1]?.name).toBe('ai_generation_log');
    expect(rows[2]?.name).toBe('content_item');
    expect(rows[0]?.checksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is a no-op on a second run', async () => {
    const outcome = await runMigrations({ pool: database.pool, logger });

    expect(outcome.applied).toEqual([]);
    expect(outcome.skipped).toBe(9);
  });

  it('stays a no-op when two runs race for the lock', async () => {
    const [first, second] = await Promise.all([
      runMigrations({ pool: database.pool, logger }),
      runMigrations({ pool: database.pool, logger }),
    ]);

    expect(first.applied).toEqual([]);
    expect(second.applied).toEqual([]);
  });

  it('leaves no advisory lock held once it returns', async () => {
    await runMigrations({ pool: database.pool, logger });

    const { rows } = await database.pool.query<{ count: string }>(
      `SELECT count(*) FROM pg_locks
       WHERE locktype = 'advisory'
         AND database = (SELECT oid FROM pg_database WHERE datname = current_database())`,
    );

    expect(rows[0]?.count).toBe('0');
  });
});

/**
 * The ordering guard, proven against a real database rather than only against the planner.
 * Two branches that each add a migration is the situation this exists for, so it is worth
 * seeing Postgres refuse it rather than trusting that the pure function is wired up.
 */
suite('the runner refuses a migration that arrives out of order', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    // Empty: this suite runs the runner itself, so it must start with nothing applied.
    database = await createTestDatabase({ migrate: false });
  }, 60_000);

  afterAll(async () => {
    await database.drop();
  });

  async function migrationDir(files: Record<string, string>): Promise<string> {
    const dir = await mkdtemp(path.join(tmpdir(), 'aria-order-'));
    for (const [name, sql] of Object.entries(files)) {
      await writeFile(path.join(dir, name), sql, 'utf8');
    }
    return dir;
  }

  it('applies 002, then rejects a 001 that turns up behind it', async () => {
    const ahead = await migrationDir({ '002_later.sql': 'CREATE TABLE later (id INT)' });
    const applied = await runMigrations({ pool: database.pool, logger, dir: ahead });
    expect(applied.applied).toEqual(['002']);

    const behind = await migrationDir({
      '001_earlier.sql': 'CREATE TABLE earlier (id INT)',
      '002_later.sql': 'CREATE TABLE later (id INT)',
    });

    await expect(runMigrations({ pool: database.pool, logger, dir: behind })).rejects.toThrow(
      /Renumber/,
    );

    // And it refused before doing anything: the table that migration would have created is
    // absent, so a rejected run leaves the database exactly as it was.
    const { rows } = await database.pool.query<{ exists: boolean }>(
      "SELECT to_regclass('public.earlier') IS NOT NULL AS exists",
    );
    expect(rows[0]?.exists).toBe(false);
  });
});

suite('the schema migrations produced', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
  }, 60_000);

  afterAll(async () => {
    await database.drop();
  });

  it('uses timestamptz for every timestamp, never a naive one', async () => {
    const { rows } = await database.pool.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND data_type = 'timestamp without time zone'`,
    );

    expect(rows).toEqual([]);
  });

  it('declares an explicit ON DELETE behaviour on every foreign key', async () => {
    const { rows } = await database.pool.query<{ constraint_name: string; delete_rule: string }>(
      `SELECT rc.constraint_name, rc.delete_rule
       FROM information_schema.referential_constraints rc
       JOIN information_schema.table_constraints tc
         ON tc.constraint_name = rc.constraint_name
       WHERE tc.table_schema = 'public'`,
    );

    expect(rows).not.toHaveLength(0);
    for (const row of rows) {
      expect(row.delete_rule).not.toBe('NO ACTION');
    }
  });

  it('makes a parent email unique only where one is present', async () => {
    await database.truncateAll();

    await database.pool.query(
      "INSERT INTO parent (id, email, display_name) VALUES ($1, NULL, 'One'), ($2, NULL, 'Two')",
      ['00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a2'],
    );

    const { rows } = await database.pool.query<{ count: string }>('SELECT count(*) FROM parent');
    expect(rows[0]?.count).toBe('2');
  });

  it('treats parent emails case-insensitively', async () => {
    await database.truncateAll();

    await database.pool.query(
      "INSERT INTO parent (id, email, display_name) VALUES ($1, 'Parent@Example.com', 'One')",
      ['00000000-0000-4000-8000-0000000000b1'],
    );

    await expect(
      database.pool.query(
        "INSERT INTO parent (id, email, display_name) VALUES ($1, 'parent@example.com', 'Two')",
        ['00000000-0000-4000-8000-0000000000b2'],
      ),
    ).rejects.toMatchObject({ code: '23505' });
  });
});

/**
 * What a deploy step depends on (X-01).
 *
 * A migration runs before the new code starts, from a job whose only job that is. Each of
 * these is a property that job's safety rests on, so each is proven against a real database
 * rather than reasoned about: a plan changes nothing, a failing file leaves nothing behind,
 * and the ordering rule has an escape hatch that an operator has to ask for by name.
 */
suite('the deploy path', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase({ migrate: false });
  }, 60_000);

  afterAll(async () => {
    await database.drop();
  });

  async function migrationDir(files: Record<string, string>): Promise<string> {
    const dir = await mkdtemp(path.join(tmpdir(), 'aria-deploy-'));
    for (const [name, sql] of Object.entries(files)) {
      await writeFile(path.join(dir, name), sql, 'utf8');
    }
    return dir;
  }

  async function tableExists(name: string): Promise<boolean> {
    const { rows } = await database.pool.query<{ exists: boolean }>(
      `SELECT to_regclass('public.${name}') IS NOT NULL AS exists`,
    );
    return rows[0]?.exists === true;
  }

  it('reports a dry run without applying anything', async () => {
    const dir = await migrationDir({ '001_planned.sql': 'CREATE TABLE planned (id INT)' });

    const outcome = await runMigrations({ pool: database.pool, logger, dir, dryRun: true });

    expect(outcome.pending).toEqual(['001']);
    expect(outcome.applied).toEqual([]);
    expect(await tableExists('planned')).toBe(false);

    // And the plan was honest: the same run without the flag does exactly what it said.
    const real = await runMigrations({ pool: database.pool, logger, dir });
    expect(real.applied).toEqual(['001']);
    expect(await tableExists('planned')).toBe(true);
  });

  it('rolls a failing migration back whole, ledger included', async () => {
    const dir = await migrationDir({
      '001_planned.sql': 'CREATE TABLE planned (id INT)',
      '002_broken.sql': 'CREATE TABLE half (id INT); CREATE TABLE half (id INT)',
    });

    await expect(runMigrations({ pool: database.pool, logger, dir })).rejects.toThrow();

    // The first statement of the failing file succeeded before the second one blew up. If the
    // file were not one transaction, `half` would exist now and the next deploy would fail
    // for a different reason than the real one.
    expect(await tableExists('half')).toBe(false);

    const { rows } = await database.pool.query<{ version: string }>(
      'SELECT version FROM schema_migration ORDER BY version',
    );
    expect(rows.map((row) => row.version)).toEqual(['001']);
  });

  it('applies an out-of-order migration only when an operator asks for it by name', async () => {
    const dir = await migrationDir({
      '000_gap.sql': 'CREATE TABLE gap (id INT)',
      '001_planned.sql': 'CREATE TABLE planned (id INT)',
    });

    await expect(runMigrations({ pool: database.pool, logger, dir })).rejects.toThrow(/Renumber/);
    expect(await tableExists('gap')).toBe(false);

    const outcome = await runMigrations({ pool: database.pool, logger, dir, allowGap: true });

    expect(outcome.applied).toEqual(['000']);
    expect(await tableExists('gap')).toBe(true);
  });
});
