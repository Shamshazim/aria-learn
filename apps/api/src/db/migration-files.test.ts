import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { checksumOf, loadMigrationFiles, MIGRATIONS_DIR, MigrationError } from './migration-files';

async function directoryWith(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'aria-migrations-'));
  for (const [name, sql] of Object.entries(files)) {
    await writeFile(path.join(dir, name), sql, 'utf8');
  }
  return dir;
}

describe('loadMigrationFiles', () => {
  it('reads the real migration directory in numeric order', async () => {
    const files = await loadMigrationFiles(MIGRATIONS_DIR);

    expect(files.length).toBeGreaterThan(0);
    expect(files.map((file) => file.version)).toEqual([...files.map((f) => f.version)].sort());
    expect(files[0]?.filename).toBe('001_identity.sql');
  });

  it('refuses a file that does not follow NNN_snake_case.sql', async () => {
    const dir = await directoryWith({ 'add-parents.sql': 'SELECT 1' });

    await expect(loadMigrationFiles(dir)).rejects.toThrow(MigrationError);
  });

  it('refuses two migrations that share a version', async () => {
    const dir = await directoryWith({ '001_a.sql': 'SELECT 1', '001_b.sql': 'SELECT 2' });

    await expect(loadMigrationFiles(dir)).rejects.toThrow(/share version 001/);
  });

  it('ignores non-sql files sitting in the directory', async () => {
    const dir = await directoryWith({ '001_a.sql': 'SELECT 1', 'README.md': 'notes' });

    expect((await loadMigrationFiles(dir)).map((file) => file.filename)).toEqual(['001_a.sql']);
  });
});

describe('checksumOf', () => {
  it('is stable across line endings, so a Windows checkout is not tampering', () => {
    expect(checksumOf('CREATE TABLE a ();\nSELECT 1;\n')).toBe(
      checksumOf('CREATE TABLE a ();\r\nSELECT 1;\r\n'),
    );
  });

  it('changes when the SQL changes', () => {
    expect(checksumOf('CREATE TABLE a ()')).not.toBe(checksumOf('CREATE TABLE b ()'));
  });
});
