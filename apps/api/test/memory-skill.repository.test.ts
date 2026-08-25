import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createInventoryService } from '@/curriculum';
import { fixedClock } from '@/lib/clock';
import { sequentialUuids } from '@/lib/ids';
import { createQualityGate } from '@/quality';
import { createArrivalEventRepository } from '@/repositories/arrival-event.repository';
import { createLearnerMemoryRepository } from '@/repositories/learner-memory.repository';
import { createSessionEventRepository } from '@/repositories/session-event.repository';
import { createSessionRepository } from '@/repositories/session.repository';
import {
  createSkillStateRepository,
  misconceptionRuntimeId,
} from '@/repositories/skill-state.repository';
import { createStudentRepository } from '@/repositories/student.repository';
import { createArrivalService } from '@/services/arrival/arrival.service';
import { createArrivalContextLoader } from '@/services/arrival/context.loader';
import { createConsolidationService } from '@/services/memory/consolidate.service';
import { createMemoryRetrievalService } from '@/services/memory/retrieve.service';
import { createMoveFactory } from '@/services/moves/move-factory';
import type { NewLearnerFact } from '@/types/memory';

import { createTestDatabase, shouldSkipDatabaseTests } from './db.harness';

import type { TestDatabase } from './db.harness';

const suite = shouldSkipDatabaseTests() ? describe.skip : describe;
const NOW = new Date('2026-08-24T20:00:00.000Z');

suite('Phase 1 memory and skill repositories', () => {
  let database: TestDatabase;
  let studentId: string;

  beforeAll(async () => {
    database = await createTestDatabase();
  }, 60_000);
  afterAll(async () => {
    await database.drop();
  });
  beforeEach(async () => {
    await database.truncateAll();
    studentId = await insertStudent(database);
  });

  it('requires evidence, expires temporary facts and preserves corrected history', async () => {
    const memory = createLearnerMemoryRepository({ db: database.pool, ids: sequentialUuids() });
    await expect(memory.insertFact(fact(studentId, 'mood', 'tired', null))).rejects.toThrow(
      /expiresAt/,
    );
    const first = await memory.insertFact(fact(studentId, 'preference', 'likes dots', null));
    const correction: NewLearnerFact = {
      ...fact(studentId, 'preference', 'likes blocks', null),
      evidence: [
        { sourceKind: 'parent_correction', sourceId: '00000000-0000-4000-8000-000000000498' },
      ],
    };
    const replacement = await memory.supersede(first.id, correction);
    expect(await memory.listCurrent(studentId, NOW)).toEqual([replacement]);
    const result = await database.pool.query<{ superseded_by: string | null }>(
      'SELECT superseded_by FROM learner_fact WHERE id = $1',
      [first.id],
    );
    expect(result.rows[0]?.superseded_by).toBe(replacement.id);
    const retrieval = createMemoryRetrievalService({
      memory,
      clock: fixedClock(NOW),
      maxTokens: 100,
      recordSize: () => undefined,
    });
    const nextTurn = await retrieval.retrieve({
      sessionId: 'session-next',
      studentId,
      band: 'middle',
      skillCode: null,
      identifiers: {},
    });
    expect(nextTurn.factIds).toEqual([replacement.id]);
    expect(nextTurn.context.value.learnerMemory).toEqual([
      { category: 'preference', text: 'likes blocks' },
    ]);
  });

  it('seeds the graph, walks backwards and updates an attempt atomically', async () => {
    const inventory = createInventoryService();
    const skills = createSkillStateRepository({ db: database.pool, clock: fixedClock(NOW) });
    await skills.seed(
      inventory.listSkills(),
      inventory.listSkills().flatMap((skill) => inventory.listMisconceptions(skill.code)),
    );
    const chain = await skills.findUnmetPrerequisites(studentId, 'ADD.REGROUP.2D');
    expect(chain.map((skill) => skill.code)).toEqual(['NUM.CNT.20', 'ADD.FACT.10']);
    const state = await skills.recordAttempt({
      studentId,
      skillCode: 'ADD.FACT.10',
      correct: true,
    });
    expect(state).toMatchObject({ attempts: 1, correctStreak: 1, strength: 0.15 });
    const misconception = await skills.recordMisconception(
      studentId,
      misconceptionRuntimeId('misconception-add-regroup-no-carry'),
    );
    const repeated = await skills.recordMisconception(studentId, misconception.misconceptionId);
    expect(repeated.secondOrLater).toBe(true);
  });

  it('consolidates evidence once and keeps a one-session mood temporary', async () => {
    const sessions = createSessionRepository({ db: database.pool, ids: sequentialUuids() });
    const session = await sessions.create({
      studentId,
      subject: 'math',
      grade: '4',
      band: 'middle',
    });
    const events = createSessionEventRepository({
      db: database.pool,
      ids: sequentialUuids(),
      clock: fixedClock(NOW),
    });
    await events.append({
      sessionId: session.id,
      actor: 'aria',
      kind: 'PRAISE',
      text: 'Yes.',
      skillCode: 'ADD.FACT.10',
      correct: null,
      latencyMs: null,
      evidence: {},
      payload: {},
    });
    await events.append({
      sessionId: session.id,
      actor: 'aria',
      kind: 'BREAK',
      text: 'We can stop.',
      skillCode: 'ADD.FACT.10',
      correct: null,
      latencyMs: null,
      evidence: {},
      payload: {},
    });
    const memory = createLearnerMemoryRepository({ db: database.pool, ids: sequentialUuids() });
    const consolidation = createConsolidationService({
      pool: database.pool,
      events,
      memory,
      clock: fixedClock(NOW),
      repetitionsForDurableFact: 1,
      countPriorSignal: (id, kind) => memory.countObservations(id, kind),
    });

    await consolidation.consolidate(session.id, studentId);
    await consolidation.consolidate(session.id, studentId);

    const facts = await database.pool.query<{ count: string }>('SELECT count(*) FROM learner_fact');
    const evidence = await database.pool.query<{ count: string }>(
      'SELECT count(*) FROM learner_fact_evidence',
    );
    const observations = await database.pool.query<{ count: string }>(
      'SELECT count(*) FROM observation',
    );
    expect({
      facts: facts.rows[0]?.count,
      evidence: evidence.rows[0]?.count,
      observations: observations.rows[0]?.count,
    }).toEqual({ facts: '1', evidence: '1', observations: '1' });

    await sessions.end(session.id, 'complete', NOW);
    const tomorrow = new Date(NOW.getTime() + 24 * 3_600_000);
    const tomorrowClock = fixedClock(tomorrow);
    const skills = createSkillStateRepository({ db: database.pool, clock: tomorrowClock });
    const arrival = createArrivalService({
      load: createArrivalContextLoader({
        students: createStudentRepository({ db: database.pool, ids: sequentialUuids() }),
        sessions,
        events,
        skills,
        memory,
        clock: tomorrowClock,
      }).load,
      arrivals: createArrivalEventRepository({
        db: database.pool,
        ids: sequentialUuids(),
        clock: tomorrowClock,
      }),
      moves: createMoveFactory({ ids: sequentialUuids(), clock: tomorrowClock }),
      gate: createQualityGate(() => ({ safe: true, categories: [] })),
      nowMs: () => tomorrow.getTime(),
    });
    const returned = await arrival.arrive(studentId);
    const factId = (await memory.listCurrent(studentId, tomorrow))[0]?.id;
    expect(returned.moves[0]).toMatchObject({ kind: 'WELCOME', basedOn: [factId] });
  });
});

function fact(
  studentId: string,
  kind: string,
  text: string,
  expiresAt: Date | null,
): NewLearnerFact {
  return {
    studentId,
    kind,
    value: { text },
    confidence: 0.9,
    firstObservedAt: NOW,
    lastConfirmedAt: NOW,
    expiresAt,
    sensitivity: 'normal',
    modelShareable: true,
    evidence: [{ sourceKind: 'observation', sourceId: '00000000-0000-4000-8000-000000000499' }],
  };
}

async function insertStudent(database: TestDatabase): Promise<string> {
  const parentId = '00000000-0000-4000-8000-000000000501';
  const id = '00000000-0000-4000-8000-000000000502';
  await database.pool.query("INSERT INTO parent (id, display_name) VALUES ($1, 'Parent')", [
    parentId,
  ]);
  await database.pool.query(
    "INSERT INTO student (id, parent_id, display_name, grade, band) VALUES ($1, $2, 'Child', '4', 'middle')",
    [id, parentId],
  );
  return id;
}
