import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  injectionFixtureSchema,
  parentAskFixtureSchema,
  realtimeFixtureSchema,
  type InjectionFixture,
  type ParentAskFixture,
  type RealtimeFixture,
} from '@/testing/adversarial/fixture.schema';

import type { ZodType } from 'zod';

/**
 * Reads the fixture files, parses them, and refuses to run on a bad one (X-05).
 *
 * A malformed fixture is not skipped and not warned about. A suite that quietly runs 58 of its
 * 60 cases reports the same green as one that runs all 60, and the two missing cases are the
 * ones somebody was mid-way through writing when they were interrupted.
 */
export const FIXTURE_ROOT = join(import.meta.dirname, 'fixtures');

export type AdversarialFixtures = Readonly<{
  injection: readonly InjectionFixture[];
  parentAsk: readonly ParentAskFixture[];
  realtime: readonly RealtimeFixture[];
}>;

export function loadAdversarialFixtures(root: string = FIXTURE_ROOT): AdversarialFixtures {
  const fixtures = {
    injection: loadFamily(root, 'injection', injectionFixtureSchema),
    parentAsk: loadFamily(root, 'parent-ask', parentAskFixtureSchema),
    realtime: loadFamily(root, 'realtime', realtimeFixtureSchema),
  };
  assertIdsAreUnique([...fixtures.injection, ...fixtures.parentAsk, ...fixtures.realtime]);
  return fixtures;
}

function loadFamily<T>(root: string, family: string, schema: ZodType<readonly T[]>): readonly T[] {
  const directory = join(root, family);
  const files = readdirSync(directory)
    .filter((name) => name.endsWith('.json'))
    .sort();
  if (files.length === 0) throw new Error(`No adversarial fixtures in ${family}.`);
  return files.flatMap((name) => parseFile(join(directory, name), schema));
}

function parseFile<T>(path: string, schema: ZodType<readonly T[]>): readonly T[] {
  const parsed = schema.safeParse(readJson(path));
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`${path} is not a valid fixture file — ${detail}`);
  }
  return parsed.data;
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (cause) {
    throw new Error(`${path} is not valid JSON`, { cause });
  }
}

/** Ids name a case in a failure message and in an incident report; two the same helps nobody. */
function assertIdsAreUnique(fixtures: readonly Readonly<{ id: string }>[]): void {
  const seen = new Set<string>();
  const duplicates = fixtures
    .map((fixture) => fixture.id)
    .filter((id) => {
      const repeated = seen.has(id);
      seen.add(id);
      return repeated;
    });
  if (duplicates.length > 0) {
    throw new Error(`Duplicate adversarial fixture ids: ${duplicates.join(', ')}`);
  }
}
