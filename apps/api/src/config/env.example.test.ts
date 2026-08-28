import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { envSchema } from './env';

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

function documentedNames(): Set<string> {
  const names = readFileSync(EXAMPLE, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
    .map((line) => line.split('=')[0]?.trim())
    .filter((name): name is string => name !== undefined && name !== '');

  return new Set(names);
}

describe('.env.example', () => {
  it('documents every variable the configuration schema reads', () => {
    const documented = documentedNames();

    expect(Object.keys(envSchema.shape).filter((name) => !documented.has(name))).toEqual([]);
  });
});
