import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { envSchema, loadConfig } from './env';

/**
 * CODE-STANDARDS §8 made mechanical: every variable the API reads is documented in
 * `.env.example`.
 *
 * It is a rule worth enforcing rather than remembering, because the failure it prevents is
 * invisible until a deploy. `CORS_ORIGINS` was read by the API and named nowhere for three
 * phases; an operator filling in an environment template would have shipped a deployment
 * where the web app could not call its own API, with nothing in the repository to say why
 * (X-01).
 */
const EXAMPLE = path.join(import.meta.dirname, '..', '..', '..', '..', '.env.example');

function documentedAssignments(): [string, string][] {
  return readFileSync(EXAMPLE, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
    .map((line): [string, string] => {
      const separator = line.indexOf('=');
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    })
    .filter(([name]) => name !== '');
}

function documentedNames(): Set<string> {
  return new Set(documentedAssignments().map(([name]) => name));
}

describe('.env.example', () => {
  it('documents every variable the configuration schema reads', () => {
    const documented = documentedNames();

    expect(Object.keys(envSchema.shape).filter((name) => !documented.has(name))).toEqual([]);
  });

  /**
   * The README's first instruction, asserted: `cp .env.example .env` has to produce a file the
   * API starts with. It did not — the template leaves optional keys blank, and a blank value
   * reached the schema as an empty string rather than as nothing, so boot failed naming ten
   * variables a developer had never been asked to fill in. `withoutBlanks` is that fix, and
   * this is the test that would have caught it: a name-only comparison never could.
   */
  it('is a file the API can boot from, unedited', () => {
    expect(() => loadConfig(Object.fromEntries(documentedAssignments()), '1.0.0')).not.toThrow();
  });
});
