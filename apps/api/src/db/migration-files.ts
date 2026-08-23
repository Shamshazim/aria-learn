import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Migrations as they exist on disk: discovered, parsed and checksummed, with no knowledge of
 * a database. Keeping this separate from the runner is what lets the ordering and drift rules
 * be tested without Postgres anywhere near them.
 */
export const MIGRATIONS_DIR = path.join(import.meta.dirname, 'migrations');

/** `NNN_snake_case.sql`. Anything else is a mistake, not a file to skip quietly. */
const FILENAME = /^(\d{3})_([a-z0-9_]+)\.sql$/;

export type MigrationFile = {
  /** The zero-padded numeric prefix, kept as text — it is the ledger's primary key. */
  version: string;
  name: string;
  filename: string;
  sql: string;
  checksum: string;
};

export class MigrationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'MigrationError';
  }
}

/**
 * Content-addressed so the runner can prove a merged migration was never edited. Line endings
 * are normalised first: a checkout on Windows must not look like tampering.
 */
export function checksumOf(sql: string): string {
  return createHash('sha256').update(sql.replace(/\r\n/g, '\n'), 'utf8').digest('hex');
}

export async function loadMigrationFiles(dir: string = MIGRATIONS_DIR): Promise<MigrationFile[]> {
  const entries = (await readdir(dir)).filter((entry) => entry.endsWith('.sql')).sort();
  const files: MigrationFile[] = [];
  const seen = new Map<string, string>();

  for (const filename of entries) {
    const match = FILENAME.exec(filename);
    if (!match?.[1] || !match[2]) {
      throw new MigrationError(
        `Migration "${filename}" is not named NNN_snake_case.sql. A file the runner cannot ` +
          'parse would be skipped silently, so it is refused instead.',
      );
    }

    const [, version, name] = match;
    const duplicate = seen.get(version);
    if (duplicate) {
      throw new MigrationError(
        `Migrations "${duplicate}" and "${filename}" share version ${version}. ` +
          'Two people numbered a migration the same; renumber the later one.',
      );
    }
    seen.set(version, filename);

    const sql = await readFile(path.join(dir, filename), 'utf8');
    files.push({ version, name, filename, sql, checksum: checksumOf(sql) });
  }

  // Lexicographic order over a fixed-width numeric prefix is numeric order, which is why the
  // prefix is zero-padded and why `version` stays a string all the way into the ledger.
  return files.sort((a, b) => a.version.localeCompare(b.version));
}
