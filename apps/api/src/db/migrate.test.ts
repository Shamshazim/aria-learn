import { describe, expect, it } from 'vitest';

import { planMigrations } from './migrate';
import { checksumOf, MigrationError } from './migration-files';

import type { AppliedMigration } from './migrate';
import type { MigrationFile } from './migration-files';

/**
 * The rules that decide what runs. They are pure, so none of this needs a database — which is
 * why the interesting failure cases are actually covered rather than described in a comment.
 */
function file(version: string, sql = `-- ${version}`): MigrationFile {
  return {
    version,
    name: 'identity',
    filename: `${version}_identity.sql`,
    sql,
    checksum: checksumOf(sql),
  };
}

function applied(file: MigrationFile): AppliedMigration {
  return { version: file.version, name: file.name, checksum: file.checksum };
}

describe('planMigrations', () => {
  it('returns every migration when the ledger is empty', () => {
    const files = [file('001'), file('002')];

    expect(planMigrations(files, []).map((m) => m.version)).toEqual(['001', '002']);
  });

  it('is a no-op once every migration is recorded', () => {
    const files = [file('001'), file('002')];

    expect(planMigrations(files, files.map(applied))).toEqual([]);
  });

  it('returns only what has not run', () => {
    const first = file('001');
    const files = [first, file('002')];

    expect(planMigrations(files, [applied(first)]).map((m) => m.version)).toEqual(['002']);
  });

  it('refuses a migration that was edited after being applied', () => {
    const original = file('001', 'CREATE TABLE a ()');
    const edited = file('001', 'CREATE TABLE a (b INT)');

    expect(() => planMigrations([edited], [applied(original)])).toThrow(MigrationError);
    expect(() => planMigrations([edited], [applied(original)])).toThrow(/never edited/);
  });

  it('refuses a migration numbered behind one that already ran', () => {
    const second = file('002');
    // The shape of two branches merging: 002 landed first, then 001 arrived behind it.
    const files = [file('001'), second];

    expect(() => planMigrations(files, [applied(second)])).toThrow(/Renumber/);
  });

  it('refuses to run when an applied migration has vanished from disk', () => {
    const deleted = file('001');

    expect(() => planMigrations([file('002')], [applied(deleted)])).toThrow(/no longer/);
  });

  it('allows a new highest migration alongside applied ones', () => {
    const [first, second, third] = [file('001'), file('002'), file('003')];
    const files = [first, second, third];

    expect(planMigrations(files, [applied(first), applied(second)]).map((m) => m.version)).toEqual([
      third.version,
    ]);
  });
});
