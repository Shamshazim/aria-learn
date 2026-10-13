import { describe, expect, it } from 'vitest';

import {
  BRIEF_PERIODS,
  CORRECTED_BY,
  CORRECTION_TARGETS,
  EPISODE_EVIDENCE_SOURCES,
  EPISODE_KINDS,
} from '@aria/shared';

import { loadMigrationFiles, MIGRATIONS_DIR } from './migration-files';

/**
 * Migration 030 duplicates the P3-01 vocabularies into CHECK constraints so the database can
 * defend itself against any writer. Like `migration-vocabulary.test.ts` for 001, this fails
 * when the copies diverge; the fix is a new migration, never an edit to 030.
 */
async function migrationSql(): Promise<string> {
  const files = await loadMigrationFiles(MIGRATIONS_DIR);
  const file = files.find((f) => f.filename === '030_learner_episode_brief.sql');
  if (!file) throw new Error('030_learner_episode_brief.sql is missing');
  return file.sql;
}

function valuesInCheck(sql: string, constraint: string): string[] {
  const clause = new RegExp(`CONSTRAINT ${constraint} CHECK \\(([\\s\\S]*?)\\)\\s*[,)]`).exec(sql);
  if (!clause?.[1]) throw new Error(`Constraint ${constraint} not found in migration 030`);
  return [...clause[1].matchAll(/'([^']*)'/g)].map((match) => match[1] ?? '');
}

describe('migration 030 vocabulary', () => {
  it.each([
    ['learner_episode_kind_valid', EPISODE_KINDS],
    ['learner_episode_evidence_source_valid', EPISODE_EVIDENCE_SOURCES],
    ['learner_brief_period_valid', BRIEF_PERIODS],
    ['learner_fact_correction_target_valid', CORRECTION_TARGETS],
    ['learner_fact_correction_author_valid', CORRECTED_BY],
  ])('%s accepts exactly the values @aria/shared defines', async (constraint, values) => {
    expect(valuesInCheck(await migrationSql(), constraint)).toEqual([...values]);
  });
});
