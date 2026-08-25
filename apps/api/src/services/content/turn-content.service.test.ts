import { describe, expect, it, vi } from 'vitest';

import { PROTOCOL_VERSION, askMoveSchema, tutorInputEventSchema } from '@aria/shared';
import type { PlannedTurn } from '@aria/tutor';

import { createInventoryService } from '@/curriculum';
import { fixedClock } from '@/lib/clock';
import { sequentialIds } from '@/lib/ids';
import { scrubLearnerContext } from '@/privacy';
import { createQualityGate } from '@/quality';
import {
  createTurnContentService,
  type ApiModelContext,
} from '@/services/content/turn-content.service';
import { createMoveFactory } from '@/services/moves/move-factory';

const NOW = new Date('2026-08-24T20:00:00.000Z');

describe('turn content', () => {
  it.each([
    'HINT',
    'RETEACH',
    'REVEAL',
    'PRAISE',
    'BREAK',
    'END',
    'LISTEN',
    'SAY',
    'SWITCH',
  ] as const)('returns a gated %s move with every provider disabled', async (kind) => {
    const gate = vi.fn(createQualityGate(() => ({ safe: true, categories: [] })));
    const service = createTurnContentService({
      reliable: {
        resolve: vi.fn(() =>
          Promise.resolve({
            source: 'fallback' as const,
            itemId: null,
            body: { prompt: 'What is four plus three?', answerKey: '7' },
          }),
        ),
      },
      ai: null,
      gate,
      moves: (sessionId) =>
        createMoveFactory({ ids: sequentialIds('move'), clock: fixedClock(NOW), sessionId }),
      remediation: () => null,
    });

    const result = await service.resolve(turn(kind));
    expect(result.moves[0]?.kind).toBe(kind);
    expect(gate).toHaveBeenCalled();
    if (kind === 'PRAISE') expect(result.moves[0]?.speech?.text).toContain('7');
  });

  it('uses the authored misconception fix instead of another generic hint', async () => {
    const inventory = createInventoryService();
    const gate = createQualityGate(() => ({ safe: true, categories: [] }));
    const service = createTurnContentService({
      reliable: { resolve: vi.fn() },
      ai: null,
      gate,
      moves: (sessionId) =>
        createMoveFactory({ ids: sequentialIds('move'), clock: fixedClock(NOW), sessionId }),
      remediation: (id) => inventory.getMisconception(id)?.remediation ?? null,
    });
    const base = turn('RETEACH');
    const input = {
      ...base,
      decision: {
        ...base.decision,
        graded: { correct: false, misconception: 'misconception-ph-silent-e-short-vowel' },
      },
    };

    const result = await service.resolve(input);
    expect(result.moves[0]?.speech?.text).toBe(
      inventory.getMisconception('misconception-ph-silent-e-short-vowel')?.remediation,
    );
  });

  it.each(['HINT', 'RETEACH'] as const)('follows %s with the active question', async (kind) => {
    const base = turn(kind);
    const service = serviceWithFallback();
    const result = await service.resolve({
      ...base,
      context: {
        ...base.context,
        modelContext: { ...base.context.modelContext, latestAsk: askMove() },
      },
    });
    expect(result.moves.map((move) => move.kind)).toEqual([kind, 'ASK']);
    expect(result.moves[1]).toMatchObject({ kind: 'ASK', itemId: 'item-1', attempt: 2 });
  });

  it.each(['answer-question', 'acknowledge-chat', 'reask-short', 'check-in'] as const)(
    'follows a %s detour with the same question and no extra attempt',
    async (approach) => {
      const base = turn('SAY');
      const result = await serviceWithFallback().resolve({
        ...base,
        plan: { ...base.plan, approach },
        context: {
          ...base.context,
          modelContext: { ...base.context.modelContext, latestAsk: askMove() },
        },
      });
      expect(result.moves.map((move) => move.kind)).toEqual(['SAY', 'ASK']);
      expect(result.moves[1]).toMatchObject({ kind: 'ASK', itemId: 'item-1', attempt: 1 });
    },
  );

  it.each(['PRAISE', 'REVEAL', 'SWITCH'] as const)(
    'follows %s with a new verified question',
    async (kind) => {
      expect(
        (await serviceWithFallback().resolve(turn(kind))).moves.map((move) => move.kind),
      ).toEqual([kind, 'ASK']);
    },
  );

  it('passes every authored misconception fix through the child-facing gate', () => {
    const inventory = createInventoryService();
    const gate = createQualityGate(() => ({ safe: true, categories: [] }));
    for (const skill of inventory.listSkills()) {
      for (const misconception of inventory.listMisconceptions(skill.code)) {
        const verdict = gate({
          id: misconception.id,
          kind: 'text',
          band: skill.band,
          childText: misconception.remediation,
          factual: false,
          grounding: 'reviewed-bank',
        });
        const reasons = verdict.verdict === 'fail' ? verdict.reasons : [];
        expect(verdict, `${misconception.id}: ${JSON.stringify(reasons)}`).toMatchObject({
          verdict: 'pass',
        });
      }
    }
  });
});

function turn(kind: PlannedTurn<ApiModelContext>['plan']['kind']): PlannedTurn<ApiModelContext> {
  const event = tutorInputEventSchema.parse({
    id: 'event-1',
    at: NOW.toISOString(),
    protocolVersion: PROTOCOL_VERSION,
    kind: 'CONFUSED',
  });
  return {
    event,
    context: {
      session: {
        id: 'session-1',
        studentId: 'student-1',
        subject: 'math',
        grade: '1',
        band: 'early',
        skillCode: 'ADD.FACT.10',
        startedAt: NOW,
        attempts: 1,
        consecutiveWrong: 1,
        consecutiveSilences: 0,
        repeatedMisconception: null,
        lastApproach: 'single-nudge',
        unmetPrerequisite: null,
      },
      modelContext: {
        scrubbed: scrubLearnerContext(
          { identifiers: {}, gradeBand: 'early' },
          { pseudonym: 'omit' },
        ),
        answerKey: '7',
        latestQuestion: 'What is four plus three?',
        estimatedTokens: 0,
        retrievedFactIds: [],
        recentContentItemIds: [],
        recentIntents: [],
        arithmeticProblem: null,
        completionOnly: false,
        latestAsk: null,
      },
      recentKinds: [],
    },
    decision: {
      allowedMoves: [kind],
      graded: null,
      terminal: kind === 'END',
      decisive: true,
      reasons: ['test_fixture'],
      defaultPlan: {
        kind,
        approach: 'different-way',
        reason: 'test',
        skillCode: 'ADD.FACT.10',
        attempt: 2,
      },
    },
    plan: { kind, approach: 'different-way', reason: 'test', skillCode: 'ADD.FACT.10', attempt: 2 },
  };
}

function serviceWithFallback() {
  return createTurnContentService({
    reliable: {
      resolve: vi.fn(() =>
        Promise.resolve({
          source: 'fallback' as const,
          itemId: null,
          body: { prompt: 'What is four plus three?', answerKey: '7' },
        }),
      ),
    },
    ai: null,
    gate: createQualityGate(() => ({ safe: true, categories: [] })),
    moves: (sessionId) =>
      createMoveFactory({ ids: sequentialIds('move'), clock: fixedClock(NOW), sessionId }),
    remediation: () => null,
  });
}

function askMove() {
  return askMoveSchema.parse(
    createMoveFactory({
      ids: sequentialIds('ask'),
      clock: fixedClock(NOW),
      sessionId: 'session-1',
    }).make({
      kind: 'ASK',
      itemId: 'item-1',
      attempt: 1,
      speech: { text: 'What is four plus three?' },
      display: [{ type: 'text', body: 'What is four plus three?', markdown: false }],
      expects: 'text',
    }),
  );
}
