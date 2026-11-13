import { afterAll, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { NotFoundError, RejectedValueError, StaleCorrectionTargetError } from '@/errors';
import { fixedClock } from '@/lib/clock';
import { sequentialUuids } from '@/lib/ids';
import { createConsolidationHistoryRepository } from '@/repositories/consolidation-history.repository';
import { createCorrectionTargetRepository } from '@/repositories/correction-target.repository';
import { createFactCorrectionRepository } from '@/repositories/fact-correction.repository';
import { createLearnerEpisodeRepository } from '@/repositories/learner-episode.repository';
import { createLearnerMemoryRepository } from '@/repositories/learner-memory.repository';
import { createSessionEventRepository } from '@/repositories/session-event.repository';
import { createConsolidationService } from '@/services/memory/consolidate.service';
import type { BriefInvalidation } from '@/services/memory/correct/invalidate';
import type { CorrectionRequest } from '@/services/memory/correct/types';
import { createParentCorrectionService } from '@/services/memory/correct.service';

import { createTestDatabase, shouldSkipDatabaseTests } from './db.harness';
import {
  NOW,
  OTHER_STUDENT_ID,
  PARENT_ID,
  SESSION_ID,
  STUDENT_ID,
  episode,
  evidenceId,
  seedFamily,
} from './memory-history.fixture';

import type { TestDatabase } from './db.harness';

const suite = shouldSkipDatabaseTests() ? describe.skip : describe;
const RANDOM_ID = '00000000-0000-4000-8000-0000000009ff';

suite('P3-06 the memory correction path', () => {
  let database: TestDatabase;
  let invalidateBrief: Mock<BriefInvalidation>;
  let ids: ReturnType<typeof sequentialUuids>;

  beforeAll(async () => {
    database = await createTestDatabase();
  }, 60_000);
  afterAll(async () => database.drop());
  beforeEach(async () => {
    await database.truncateAll();
    await seedFamily(database);
    invalidateBrief = vi.fn<BriefInvalidation>(() => Promise.resolve());
    ids = sequentialUuids();
  });

  function stores() {
    return {
      facts: createLearnerMemoryRepository({ db: database.pool, ids }),
      episodes: createLearnerEpisodeRepository({ db: database.pool, ids }),
      corrections: createFactCorrectionRepository({ db: database.pool, ids }),
      targets: createCorrectionTargetRepository(database.pool),
    };
  }

  function service() {
    return createParentCorrectionService({
      pool: database.pool,
      stores: stores(),
      ids,
      clock: fixedClock(NOW),
      invalidateBrief,
      // The parent owns both siblings; anyone else's child is not found.
      requireOwned: (parentId) =>
        parentId === PARENT_ID
          ? Promise.resolve()
          : Promise.reject(new NotFoundError('not theirs')),
    });
  }

  async function preference(text = 'Loves space stories.', studentId = STUDENT_ID) {
    return stores().facts.insertFact({
      studentId,
      kind: 'preference',
      value: { text },
      confidence: 0.9,
      firstObservedAt: NOW,
      lastConfirmedAt: NOW,
      expiresAt: null,
      sensitivity: 'normal',
      modelShareable: true,
      evidence: [{ sourceKind: 'session_event', sourceId: evidenceId(1) }],
    });
  }

  const correct = (request: CorrectionRequest, childId = STUDENT_ID) =>
    service().correct({ parentId: PARENT_ID, childId, request });

  const count = async (table: string): Promise<number> => {
    // Table names come from the call sites below, never from input.
    const result = await database.pool.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM ${table}`,
    );
    return result.rows[0]?.n ?? -1;
  };

  it('replaces: a correction-backed fact, the old one superseded, an audit row, current at once', async () => {
    const old = await preference();
    const result = await correct({
      targetKind: 'fact',
      targetId: old.id,
      action: 'replace',
      newValue: { text: 'Loves mystery stories.' },
      reason: 'She moved on from space.',
    });
    expect(result.status).toBe('applied');
    const current = await stores().facts.listCurrent(STUDENT_ID, NOW);
    expect(current.map((fact) => [fact.value.text, fact.confidence, fact.corrected])).toEqual([
      ['Loves mystery stories.', 1, true],
    ]);
    const evidence = await database.pool.query<{ source_kind: string; source_id: string }>(
      'SELECT source_kind, source_id FROM learner_fact_evidence WHERE fact_id = $1',
      [result.replacementId],
    );
    expect(evidence.rows).toEqual([{ source_kind: 'correction', source_id: result.correctionId }]);
    const audit = await stores().corrections.listForStudent(STUDENT_ID);
    expect(audit[0]).toMatchObject({
      correctedBy: 'parent',
      correctedById: PARENT_ID,
      oldValue: { text: 'Loves space stories.' },
      newValue: { text: 'Loves mystery stories.' },
      reason: 'She moved on from space.',
    });
    expect(invalidateBrief).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ studentId: STUDENT_ID, correctionId: result.correctionId }),
    );
  });

  it("retracts: the fact expires, stays for the audit, and is gone from Aria's view", async () => {
    const old = await preference();
    const result = await correct({ targetKind: 'fact', targetId: old.id, action: 'retract' });
    expect(result).toMatchObject({ status: 'applied', replacementId: null });
    expect(await stores().facts.listCurrent(STUDENT_ID, NOW)).toEqual([]);
    const row = await database.pool.query<{ superseded_by: string | null; expires_at: Date }>(
      'SELECT superseded_by, expires_at FROM learner_fact WHERE id = $1',
      [old.id],
    );
    expect(row.rows[0]).toEqual({ superseded_by: null, expires_at: NOW });
  });

  it('answers a stale target with 409 and the row that is current now', async () => {
    const old = await preference();
    const replaced = await correct({
      targetKind: 'fact',
      targetId: old.id,
      action: 'replace',
      newValue: { text: 'Loves mystery stories.' },
    });
    const again = correct({ targetKind: 'fact', targetId: old.id, action: 'retract' });
    await expect(again).rejects.toBeInstanceOf(StaleCorrectionTargetError);
    await expect(again).rejects.toMatchObject({
      status: 409,
      details: { currentId: replaced.replacementId },
    });
  });

  it('lets two concurrent corrections of one fact through one at a time: the second gets 409', async () => {
    const old = await preference();
    const results = await Promise.allSettled([
      correct({
        targetKind: 'fact',
        targetId: old.id,
        action: 'replace',
        newValue: { text: 'Loves maps.' },
      }),
      correct({
        targetKind: 'fact',
        targetId: old.id,
        action: 'replace',
        newValue: { text: 'Loves boats.' },
      }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const failed = results.find((result) => result.status === 'rejected');
    expect(failed?.status === 'rejected' ? failed.reason : null).toBeInstanceOf(
      StaleCorrectionTargetError,
    );
    expect(await stores().facts.listCurrent(STUDENT_ID, NOW)).toHaveLength(1);
  });

  it('does nothing for a replacement that says what the memory already says', async () => {
    const old = await preference();
    const result = await correct({
      targetKind: 'fact',
      targetId: old.id,
      action: 'replace',
      newValue: { text: 'Loves space stories.' },
    });
    expect(result).toEqual({ status: 'unchanged', correctionId: null, replacementId: null });
    expect([await count('learner_fact'), await count('learner_fact_correction')]).toEqual([1, 0]);
    expect(invalidateBrief).not.toHaveBeenCalled();
  });

  it.each([
    ['sensitive', 'Takes medication for ADHD.'],
    ['judgement', 'He is lazy.'],
  ] as const)('refuses a %s replacement with 422 and writes nothing', async (rule, text) => {
    const old = await preference();
    const refused = correct({
      targetKind: 'fact',
      targetId: old.id,
      action: 'replace',
      newValue: { text },
    });
    await expect(refused).rejects.toBeInstanceOf(RejectedValueError);
    await expect(refused).rejects.toMatchObject({ status: 422, rule });
    expect([await count('learner_fact'), await count('learner_fact_correction')]).toEqual([1, 0]);
  });

  it("cannot reach a sibling's memory through another child, or anyone else's child", async () => {
    const theirs = await preference('Loves trains.', OTHER_STUDENT_ID);
    const sibling = correct({ targetKind: 'fact', targetId: theirs.id, action: 'retract' });
    const random = correct({ targetKind: 'fact', targetId: RANDOM_ID, action: 'retract' });
    await expect(sibling).rejects.toBeInstanceOf(NotFoundError);
    await expect(random).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      service().correct({
        parentId: '00000000-0000-4000-8000-0000000009aa',
        childId: STUDENT_ID,
        request: { targetKind: 'fact', targetId: theirs.id, action: 'retract' },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('corrects an episode: a new description over the same evidence, or a retraction', async () => {
    const episodes = stores().episodes;
    const original = await episodes.insert(episode({ summary: 'Read a page about rockets.' }));
    const result = await correct({
      targetKind: 'episode',
      targetId: original.id,
      action: 'replace',
      newValue: { text: 'Read a page about submarines.' },
    });
    const current = await episodes.listCurrent(STUDENT_ID, NOW);
    expect(current.map((item) => [item.id, item.summary])).toEqual([
      [result.replacementId, 'Read a page about submarines.'],
    ]);
    expect(await episodes.hasEvidence('session_event', evidenceId(1))).toBe(true);
    await correct({
      targetKind: 'episode',
      targetId: result.replacementId ?? '',
      action: 'retract',
    });
    expect(await episodes.listCurrent(STUDENT_ID, NOW)).toEqual([]);
  });

  it('keeps a corrected fact through a later consolidation that contradicts it', async () => {
    const old = await preference();
    await correct({
      targetKind: 'fact',
      targetId: old.id,
      action: 'replace',
      newValue: { text: 'Loves mystery stories.' },
    });
    const events = createSessionEventRepository({ db: database.pool, ids, clock: fixedClock(NOW) });
    const said = await events.append({
      sessionId: SESSION_ID,
      actor: 'child',
      kind: 'SPEECH_FINAL',
      text: 'I love dinosaur books',
      skillCode: null,
      correct: null,
      latencyMs: null,
      evidence: {},
      payload: {},
    });
    const memory = stores().facts;
    await createConsolidationService({
      events,
      memory,
      pool: database.pool,
      clock: fixedClock(NOW),
      repetitionsForDurableFact: 1,
      episodes: createLearnerEpisodeRepository({ db: database.pool, ids: sequentialUuids() }),
      history: createConsolidationHistoryRepository(database.pool),
      modelProposer: {
        propose: () =>
          Promise.resolve([
            {
              kind: 'preference',
              text: 'Loves dinosaur books.',
              confidence: 0.95,
              temporary: false,
              sensitive: false,
              sourceEventId: said.id,
              skillCode: null,
            },
          ]),
      },
    }).consolidate(SESSION_ID, STUDENT_ID);
    const current = await memory.listCurrent(STUDENT_ID, NOW);
    expect(current.map((fact) => fact.value.text)).toEqual(['Loves mystery stories.']);
  });
});
