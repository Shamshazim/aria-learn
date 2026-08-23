import { describe, expect, it } from 'vitest';

import { BANDS, GRADES } from '@aria/shared';

import { loadMigrationFiles, MIGRATIONS_DIR } from './migration-files';

/**
 * Migration 001 duplicates the grade and band vocabulary into CHECK constraints, because the
 * database has to defend itself against any writer. Duplication is only safe if something
 * notices when the two copies diverge — this is that something.
 *
 * A migration is never edited once merged, so if `@aria/shared` gains a grade, this test
 * fails and the fix is a *new* migration that alters the constraint. That is the intended
 * workflow, not an obstacle to it.
 */
async function identitySql(): Promise<string> {
  const files = await loadMigrationFiles(MIGRATIONS_DIR);
  const identity = files.find((file) => file.filename === '001_identity.sql');
  if (!identity) throw new Error('001_identity.sql is missing');
  return identity.sql;
}

function valuesInCheck(sql: string, constraint: string): string[] {
  const clause = new RegExp(`CONSTRAINT ${constraint} CHECK \\(([\\s\\S]*?)\\)\\s*[,)]`).exec(sql);
  if (!clause?.[1]) throw new Error(`Constraint ${constraint} not found in 001_identity.sql`);
  return [...clause[1].matchAll(/'([^']*)'/g)].map((match) => match[1] ?? '');
}

describe('migration 001 vocabulary', () => {
  it('accepts exactly the grades @aria/shared defines', async () => {
    expect(valuesInCheck(await identitySql(), 'student_grade_valid')).toEqual([...GRADES]);
  });

  it('accepts exactly the bands @aria/shared defines', async () => {
    expect(valuesInCheck(await identitySql(), 'student_band_valid')).toEqual([...BANDS]);
  });
});
