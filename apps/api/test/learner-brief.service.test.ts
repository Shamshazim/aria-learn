import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createAiClient, type AiClientDependencies } from '@/ai';
import { fixedClock } from '@/lib/clock';
import { sequentialUuids } from '@/lib/ids';
import { createBriefEvidenceRepository } from '@/repositories/brief-evidence.repository';
import { createCorrectionTargetRepository } from '@/repositories/correction-target.repository';
import { createFactCorrectionRepository } from '@/repositories/fact-correction.repository';
import { createLearnerBriefRepository } from '@/repositories/learner-brief.repository';
import { createLearnerEpisodeRepository } from '@/repositories/learner-episode.repository';
import { createLearnerMemoryRepository } from '@/repositories/learner-memory.repository';
import { createSkillStateRepository } from '@/repositories/skill-state.repository';
import { createStudentRepository } from '@/repositories/student.repository';
import { createBriefService } from '@/services/brief/brief.service';
import { createBriefInvalidation } from '@/services/memory/correct/invalidate';
import { createParentCorrectionService } from '@/services/memory/correct.service';

import { createTestDatabase, shouldSkipDatabaseTests } from './db.harness';
import {
  evidenceId,
  NOW,
  PARENT_ID,
  SESSION_ID,
  STUDENT_ID,
  seedFamily,
} from './memory-history.fixture';

import type { TestDatabase } from './db.harness';

const suite = shouldSkipDatabaseTests() ? describe.skip : describe;
type Provider = AiClientDependencies['provider'];

/** A model that writes one sentence per piece of evidence it is offered, citing it. */
const ECHO: Provider = {
  complete: (request) => {
    const sentences = [...request.user.matchAll(/^\[([FES]\d+)\] (.+)$/gmu)].map(
      ([, ref = '', text = '']) => ({
        text: `[child] ${text.replace(/\.$/u, '')}.`,
        refs: [ref],
      }),
    );
    return Promise.resolve({
      text: JSON.stringify({ sentences }),
      endpointName: 'teach',
      model: 'fake',
      tokensIn: 1,
      tokensOut: 1,
      costUsd: 0,
      latencyMs: 1,
      finishReason: 'stop',
    });
  },
  stream: async function* () {
    yield await Promise.reject(new Error('not used'));
  },
};

suite('P3-03 the learner brief, against the tables', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
  }, 60_000);
  afterAll(async () => database.drop());
  beforeEach(async () => {
    await database.truncateAll();
    await seedFamily(database);
    // The fixture's session starts at the wall clock; this suite's week is the fixture's NOW.
    await database.pool.query('UPDATE session SET started_at = $1 WHERE id = $2', [
      NOW,
      SESSION_ID,
    ]);
  });

  function build() {
    const ids = sequentialUuids();
    const facts = createLearnerMemoryRepository({ db: database.pool, ids });
    const episodes = createLearnerEpisodeRepository({ db: database.pool, ids });
    const briefs = createLearnerBriefRepository({ db: database.pool, ids });
    const brief = createBriefService({
      sources: {
        facts,
        episodes,
        skills: createSkillStateRepository({ db: database.pool, clock: fixedClock(NOW) }),
        sessions: createBriefEvidenceRepository(database.pool),
        skillName: () => null,
      },
      briefs,
      students: createStudentRepository({ db: database.pool, ids }),
      ai: createAiClient({
        provider: ECHO,
        accounting: {
          assertWithinCap: () => Promise.resolve(),
          record: () => Promise.resolve(),
          recordCachedHit: () => Promise.resolve(),
        },
        now: () => 0,
      }),
      safe: () => true,
      clock: fixedClock(NOW),
      logger: { info: vi.fn(), warn: vi.fn() },
    });
    return { ids, facts, episodes, briefs, brief };
  }

  async function preference(facts: ReturnType<typeof build>['facts'], text: string) {
    return facts.insertFact({
      studentId: STUDENT_ID,
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

  it('gives the turn nothing until a week brief exists, then the newest one, keeping the old', async () => {
    const { facts, brief, briefs } = build();
    expect(await brief.currentForTurn(STUDENT_ID, NOW)).toBeNull();
    await preference(facts, 'Loves space stories.');
    const first = await brief.generate({ studentId: STUDENT_ID, period: 'week', periodStart: NOW });
    expect(first).not.toBeNull();
    expect(await brief.currentForTurn(STUDENT_ID, NOW)).toContain('space stories');
    const second = await brief.generate({
      studentId: STUDENT_ID,
      period: 'week',
      periodStart: NOW,
    });
    const history = await briefs.history(STUDENT_ID, 'week');
    expect(history.map((item) => [item.version, item.supersededBy])).toEqual([
      [2, null],
      [1, second?.id],
    ]);
    const later = new Date(NOW.getTime() + 15 * 86_400_000);
    expect(await brief.currentForTurn(STUDENT_ID, later)).toBeNull();
  });

  it('rebuilds the week brief after a parent correction, without the corrected value', async () => {
    const { ids, facts, episodes, brief } = build();
    const old = await preference(facts, 'Loves space stories.');
    await brief.generate({ studentId: STUDENT_ID, period: 'week', periodStart: NOW });
    const tasks: Promise<void>[] = [];
    const corrections = createParentCorrectionService({
      pool: database.pool,
      stores: {
        facts,
        episodes,
        corrections: createFactCorrectionRepository({ db: database.pool, ids }),
        targets: createCorrectionTargetRepository(database.pool),
      },
      ids,
      clock: fixedClock(NOW),
      requireOwned: () => Promise.resolve(),
      invalidateBrief: createBriefInvalidation({
        logger: { info: vi.fn(), warn: vi.fn() },
        regenerate: (studentId, at) =>
          brief.generate({ studentId, period: 'week', periodStart: at }),
        schedule: (task) => {
          tasks.push(task());
        },
      }),
    });
    await corrections.correct({
      parentId: PARENT_ID,
      childId: STUDENT_ID,
      request: {
        targetKind: 'fact',
        targetId: old.id,
        action: 'replace',
        newValue: { text: 'Loves mystery stories.' },
      },
    });
    await Promise.all(tasks);
    const current = await brief.currentForTurn(STUDENT_ID, NOW);
    expect(current).toContain('mystery stories');
    expect(current).not.toContain('space stories');
  });
});
