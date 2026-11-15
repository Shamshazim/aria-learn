import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { evaluatePhase3Exit } from '@aria/tutor';

import { assembleEvidence } from '@/observability/report/phase3/collect';
import { NO_GOLDEN_EVIDENCE } from '@/observability/report/phase3/golden.collector';
import { NO_HUMAN_EVIDENCE } from '@/observability/report/phase3/observations';
import { createPhase3EvidenceRepository } from '@/repositories/phase3-evidence.repository';

import { createTestDatabase, shouldSkipDatabaseTests } from './db.harness';
import {
  evidenceId,
  NOW,
  OTHER_STUDENT_ID,
  SESSION_ID,
  STUDENT_ID,
  seedFamily,
} from './memory-history.fixture';

import type { TestDatabase } from './db.harness';

const suite = shouldSkipDatabaseTests() ? describe.skip : describe;
const DAY = 86_400_000;
const OTHER_SESSION = '00000000-0000-4000-8000-000000000705';
const id = (n: number) => `00000000-0000-4000-8000-${String(900 + n).padStart(12, '0')}`;

suite('P3-08 phase3:report on a seeded database', () => {
  let database: TestDatabase;
  beforeAll(async () => {
    database = await createTestDatabase();
  }, 60_000);
  afterAll(async () => database.drop());
  beforeEach(async () => {
    await database.truncateAll();
    await seedFamily(database);
    await seed(database);
  });

  it('counts welcomes, evidence links, engagement facts and rebuild drift exactly', async () => {
    const loaded = await createPhase3EvidenceRepository(database.pool).load();
    expect(loaded).toEqual({
      // Both children came back within a fortnight; only one welcome named evidence.
      welcomes: { cohort: 2, evidenceBacked: 1 },
      evidenceLinks: { facts: 3, factsWithoutEvidence: 1, episodes: 1, episodesWithoutEvidence: 0 },
      engagementFactsCreated: 1,
      rebuild: { students: 1, maxDrift: 0.03 },
    });
  });

  it('produces the evidence the gate consumes, and the gate reads it honestly', async () => {
    const evidence = assembleEvidence({
      at: NOW,
      database: await createPhase3EvidenceRepository(database.pool).load(),
      golden: NO_GOLDEN_EVIDENCE,
      arrivalP95Ms: null,
      human: NO_HUMAN_EVIDENCE,
    });
    const statuses = Object.fromEntries(
      evaluatePhase3Exit(evidence).results.map((result) => [result.id, result.status]),
    );
    expect(statuses).toMatchObject({
      'opens-knowing-child': 'missing',
      'claims-link-to-evidence': 'failed',
      'adapts-without-label': 'missing',
      'rebuild-drift': 'passed',
      'bar-approach-changes': 'missing',
    });
  });

  it('turns an unreachable database into missing evidence, never zero problems', () => {
    const evidence = assembleEvidence({
      at: NOW,
      database: null,
      golden: NO_GOLDEN_EVIDENCE,
      arrivalP95Ms: null,
      human: NO_HUMAN_EVIDENCE,
    });
    expect(evaluatePhase3Exit(evidence).results.every((result) => result.status !== 'passed')).toBe(
      true,
    );
  });
});

async function seed(database: TestDatabase): Promise<void> {
  const q = (sql: string, params: unknown[]) => database.pool.query(sql, params);
  const yesterday = new Date(NOW.getTime() - DAY);
  await q('UPDATE session SET started_at = $1, ended_at = $2 WHERE id = $3', [
    yesterday,
    yesterday,
    SESSION_ID,
  ]);
  await q(
    "INSERT INTO session (id, student_id, subject, grade, band, started_at, ended_at) VALUES ($1, $2, 'arithmetic', '2', 'early', $3, $3)",
    [OTHER_SESSION, OTHER_STUDENT_ID, yesterday],
  );
  // Each child's latest arrival is today; an older one must not be the one counted.
  await q(
    "INSERT INTO arrival_event (id, student_id, at, welcome_kind) VALUES ($1, $2, $3, 'first')",
    [id(1), STUDENT_ID, new Date(NOW.getTime() - 9 * DAY)],
  );
  await q(
    "INSERT INTO arrival_event (id, student_id, at, welcome_kind) VALUES ($1, $2, $3, 'evidence_fact')",
    [id(2), STUDENT_ID, NOW],
  );
  await q(
    "INSERT INTO arrival_event (id, student_id, at, welcome_kind) VALUES ($1, $2, $3, 'long_absence')",
    [id(3), OTHER_STUDENT_ID, NOW],
  );
  const fact = (n: number, kind: string, evidenced: boolean) =>
    q(
      'INSERT INTO learner_fact (id, student_id, kind, value, confidence, first_observed_at, last_confirmed_at, sensitivity) VALUES ($1, $2, $3, \'{"text":"x"}\', 0.9, $4, $4, \'normal\')',
      [id(10 + n), STUDENT_ID, kind, NOW],
    ).then(() =>
      evidenced
        ? q(
            "INSERT INTO learner_fact_evidence (fact_id, source_kind, source_id) VALUES ($1, 'session_event', $2)",
            [id(10 + n), evidenceId(n)],
          )
        : null,
    );
  await fact(1, 'practice_persistence', true);
  await fact(2, 'preference', false);
  await fact(3, 'mood', true);
  await q(
    "INSERT INTO learner_episode (id, student_id, at, kind, summary, importance, source_session_id, sensitivity) VALUES ($1, $2, $3, 'breakthrough', 'Carried the ten.', 0.8, $4, 'normal')",
    [id(20), STUDENT_ID, NOW, SESSION_ID],
  );
  await q(
    "INSERT INTO learner_episode_evidence (episode_id, source_kind, source_id) VALUES ($1, 'session_event', $2)",
    [id(20), evidenceId(5)],
  );
  // An older run with worse drift, superseded by the latest one.
  await q(
    'INSERT INTO memory_rebuild_run (id, student_id, started_at, finished_at, drift_score) VALUES ($1, $2, $3, $3, 0.4)',
    [id(30), STUDENT_ID, new Date(NOW.getTime() - 3 * DAY)],
  );
  await q(
    'INSERT INTO memory_rebuild_run (id, student_id, started_at, finished_at, drift_score) VALUES ($1, $2, $3, $3, 0.03)',
    [id(31), STUDENT_ID, NOW],
  );
}
