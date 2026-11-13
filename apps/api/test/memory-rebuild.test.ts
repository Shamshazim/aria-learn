import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { fixedClock } from '@/lib/clock';
import { sequentialUuids } from '@/lib/ids';
import { createConsolidationHistoryRepository } from '@/repositories/consolidation-history.repository';
import { createFactCorrectionRepository } from '@/repositories/fact-correction.repository';
import { createLearnerEpisodeRepository } from '@/repositories/learner-episode.repository';
import { createLearnerMemoryRepository } from '@/repositories/learner-memory.repository';
import { createMemoryShadowRepository } from '@/repositories/memory-shadow.repository';
import { createSessionEventRepository } from '@/repositories/session-event.repository';
import { createConsolidationService } from '@/services/memory/consolidate.service';
import { createRebuildService } from '@/services/memory/rebuild/rebuild.service';
import { createMemoryRetrievalService } from '@/services/memory/retrieve.service';

import { createTestDatabase, shouldSkipDatabaseTests } from './db.harness';
import { NOW, SESSION_ID, SKILL_CODE, STUDENT_ID, seedFamily } from './memory-history.fixture';

import type { TestDatabase } from './db.harness';

const suite = shouldSkipDatabaseTests() ? describe.skip : describe;
const LIVE = [
  'learner_fact',
  'learner_fact_evidence',
  'observation',
  'learner_episode',
  'learner_episode_evidence',
];

suite('P3-02 consolidation v2 and the rebuild', () => {
  let database: TestDatabase;
  let ids: ReturnType<typeof sequentialUuids>;

  beforeAll(async () => {
    database = await createTestDatabase();
  }, 60_000);
  afterAll(async () => database.drop());
  beforeEach(async () => {
    await database.truncateAll();
    await seedFamily(database);
    await database.pool.query('UPDATE session SET started_at = $1 WHERE id = $2', [
      NOW,
      SESSION_ID,
    ]);
    ids = sequentialUuids();
  });

  const clock = fixedClock(NOW);
  const repos = () => ({
    events: createSessionEventRepository({ db: database.pool, ids, clock }),
    memory: createLearnerMemoryRepository({ db: database.pool, ids }),
    episodes: createLearnerEpisodeRepository({ db: database.pool, ids }),
    history: createConsolidationHistoryRepository(database.pool),
  });
  const skillName = (code: string) => (code === SKILL_CODE ? 'Fixture skill' : null);

  const consolidation = () =>
    createConsolidationService({
      ...repos(),
      pool: database.pool,
      clock,
      repetitionsForDurableFact: 1,
      skillName,
    });

  const rebuild = () =>
    createRebuildService({
      ...repos(),
      pool: database.pool,
      corrections: createFactCorrectionRepository({ db: database.pool, ids }),
      shadow: createMemoryShadowRepository(database.pool),
      ids,
      clock,
      repetitionsForDurableFact: 1,
      skillName,
    });

  /** A session with something to remember: a finished step, and a skill that took three tries to explain. */
  async function sessionWithEvidence(): Promise<string> {
    const events = repos().events;
    const praise = await events.append({
      sessionId: SESSION_ID,
      actor: 'aria',
      kind: 'PRAISE',
      text: 'You finished that step.',
      skillCode: SKILL_CODE,
      correct: null,
      latencyMs: null,
      evidence: {},
      payload: {},
    });
    for (let index = 0; index < 3; index += 1) {
      await events.append({
        sessionId: SESSION_ID,
        actor: 'aria',
        kind: 'RETEACH',
        text: 'Let us look at it another way.',
        skillCode: SKILL_CODE,
        correct: null,
        latencyMs: null,
        evidence: {},
        payload: {},
      });
    }
    return praise.id;
  }

  async function counts(): Promise<Record<string, number>> {
    const entries = await Promise.all(
      LIVE.map(async (table) => {
        // Table names come from the constant list above, never from input.
        const result = await database.pool.query<{ n: number }>(
          `SELECT COUNT(*)::int AS n FROM ${table}`,
        );
        return [table, result.rows[0]?.n ?? -1] as const;
      }),
    );
    return Object.fromEntries(entries);
  }

  it('writes a fact and an evidence-backed episode once; a second run writes nothing', async () => {
    await sessionWithEvidence();
    await consolidation().consolidate(SESSION_ID, STUDENT_ID);
    const first = await counts();
    expect(first).toMatchObject({ learner_fact: 1, learner_episode: 1 });
    expect(first.learner_episode_evidence).toBeGreaterThanOrEqual(1);
    const episodes = await repos().episodes.listCurrent(STUDENT_ID, NOW);
    expect(episodes.map((episode) => [episode.kind, episode.summary])).toEqual([
      ['struggle', 'Fixture skill was hard going this session; Aria tried it another way.'],
    ]);
    await consolidation().consolidate(SESSION_ID, STUDENT_ID);
    expect(await counts()).toEqual(first);
  });

  it('never remembers anything from an event the safety layer flagged', async () => {
    const praiseId = await sessionWithEvidence();
    await database.pool.query(
      `INSERT INTO safety_flag (id, student_id, session_id, event_id, category, severity)
       VALUES (gen_random_uuid(), $1, $2, $3, 'general_distress', 'high')`,
      [STUDENT_ID, SESSION_ID, praiseId],
    );
    await consolidation().consolidate(SESSION_ID, STUDENT_ID);
    expect((await counts()).learner_fact).toBe(0);
  });

  it('rebuilds to zero drift against a fresh consolidation, writing nothing live', async () => {
    await sessionWithEvidence();
    await consolidation().consolidate(SESSION_ID, STUDENT_ID);
    const before = await counts();
    const result = await rebuild().rebuild(STUDENT_ID);
    expect(result.report).toMatchObject({
      driftScore: 0,
      counts: { shadow: 2, live: 2, shared: 2 },
    });
    expect(await counts()).toEqual(before);
    const shadow = await database.pool.query<{ n: number }>(
      'SELECT COUNT(*)::int AS n FROM learner_fact_shadow WHERE rebuild_run_id = $1',
      [result.runId],
    );
    expect(shadow.rows[0]?.n).toBe(1);
    const run = await database.pool.query<{ drift_score: string; finished_at: Date | null }>(
      'SELECT drift_score, finished_at FROM memory_rebuild_run WHERE id = $1',
      [result.runId],
    );
    expect(Number(run.rows[0]?.drift_score)).toBe(0);
    expect(run.rows[0]?.finished_at).not.toBeNull();
  });

  it('reports a hand-edited fact as drift, by name', async () => {
    await sessionWithEvidence();
    await consolidation().consolidate(SESSION_ID, STUDENT_ID);
    await database.pool.query(
      `UPDATE learner_fact SET value = jsonb_set(value, '{text}', '"Is brilliant at everything."')`,
    );
    const { report } = await rebuild().rebuild(STUDENT_ID);
    expect(report.driftScore).toBeGreaterThan(0);
    expect(report.onlyInLive).toContain('practice_persistence|is brilliant at everything');
  });

  it('keeps an expired fact out of retrieval and out of the scrubbed context', async () => {
    const memory = repos().memory;
    await memory.insertFact({
      studentId: STUDENT_ID,
      kind: 'preference',
      value: { text: 'Loved dinosaurs last spring.' },
      confidence: 0.9,
      firstObservedAt: new Date(NOW.getTime() - 200 * 86_400_000),
      lastConfirmedAt: new Date(NOW.getTime() - 200 * 86_400_000),
      expiresAt: new Date(NOW.getTime() - 20 * 86_400_000),
      sensitivity: 'normal',
      modelShareable: true,
      evidence: [{ sourceKind: 'session_event', sourceId: ids.next() }],
    });
    expect(await memory.listCurrent(STUDENT_ID, NOW)).toEqual([]);
    const retrieved = await createMemoryRetrievalService({
      memory,
      clock,
      maxTokens: 300,
      recordSize: () => undefined,
    }).retrieve({
      sessionId: SESSION_ID,
      studentId: STUDENT_ID,
      band: 'early',
      skillCode: null,
      identifiers: {},
    });
    expect(JSON.stringify(retrieved.context.value)).not.toContain('dinosaurs');
  });
});
