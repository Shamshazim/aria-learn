import { describe, expect, it, vi } from 'vitest';

import { PROTOCOL_VERSION, tutorInputEventSchema, type Band } from '@aria/shared';
import { classifyIntent, createTeachingPolicy, type PlannedTurn } from '@aria/tutor';

import { createAiClient, type AiClient } from '@/ai';
import type { LlmResponse } from '@/ai/provider';
import { fixedClock } from '@/lib/clock';
import { sequentialIds } from '@/lib/ids';
import { scrubLearnerContext } from '@/privacy';
import { createQualityGate } from '@/quality';
import {
  createTurnContentService,
  type ApiModelContext,
} from '@/services/content/turn-content.service';
import { createMoveFactory } from '@/services/moves/move-factory';

const NOW = new Date('2026-08-25T10:00:00.000Z');
const DISCLOSURE = 'i live at 14 Maple Street';

const BODY: LlmResponse = {
  text: JSON.stringify({ text: 'Anything at all.' }),
  endpointName: 'teach-primary',
  model: 'teacher-model',
  tokensIn: 1,
  tokensOut: 1,
  costUsd: 0,
  latencyMs: 1,
  finishReason: 'stop',
};

/** A provider that would happily answer, so "never called" means the code chose not to. */
function neverCalled() {
  return vi.fn((): Promise<LlmResponse> => Promise.resolve(BODY));
}

function client(complete: (request: never) => Promise<LlmResponse>): AiClient {
  return createAiClient({
    provider: {
      complete,
      stream: async function* () {
        yield await Promise.resolve({ kind: 'complete', response: BODY } as const);
      },
    },
    accounting: {
      assertWithinCap: vi.fn(() => Promise.resolve()),
      record: vi.fn(() => Promise.resolve()),
      recordCachedHit: vi.fn(() => Promise.resolve()),
    },
    now: () => 0,
  });
}

const policy = createTeachingPolicy<ApiModelContext>({
  gradeAnswer: () => ({ correct: false, misconception: null }),
  classifyIntent: (event) =>
    classifyIntent(event.kind === 'ANSWER' ? (event.text ?? '') : event.text, { answerKey: '7' })
      .intent,
  sessionLimitMs: () => 20 * 60_000,
  now: () => NOW,
});

function turnFor(text: string, band: Band) {
  const event = tutorInputEventSchema.parse({
    id: 'event-1',
    at: NOW.toISOString(),
    protocolVersion: PROTOCOL_VERSION,
    kind: 'ANSWER',
    respondsTo: 'ask-1',
    text,
  });
  const context = {
    session: {
      id: 'session-1',
      studentId: 'student-1',
      subject: 'math',
      grade: band === 'early' ? '1' : band === 'middle' ? '4' : '7',
      band,
      skillCode: 'ADD.FACT.10',
      startedAt: NOW,
      attempts: 1,
      consecutiveWrong: 0,
      consecutiveSilences: 0,
      consecutiveStuck: 0,
      correctStreak: 0,
      nextTopic: null,
      repeatedMisconception: null,
      lastApproach: null,
      unmetPrerequisite: null,
    },
    modelContext: {
      scrubbed: scrubLearnerContext({ identifiers: {}, gradeBand: band }, { pseudonym: 'omit' }),
      answerKey: '7',
      latestQuestion: 'What is four plus three?',
      estimatedTokens: 0,
      retrievedFactIds: [],
      recentContentItemIds: [],
      recentIntents: [],
      arithmeticProblem: null,
      lesson: null,
      completionOnly: false,
      latestAsk: null,
    },
    recentKinds: [],
  } as const;
  const decision = policy(context, event);
  const turn: PlannedTurn<ApiModelContext> = {
    event,
    context,
    decision,
    plan: decision.defaultPlan,
  };
  return turn;
}

function service(ai: AiClient) {
  return createTurnContentService({
    reliable: { resolve: vi.fn() },
    ai,
    gate: createQualityGate(() => ({ safe: true, categories: [] })),
    moves: (sessionId) =>
      createMoveFactory({ ids: sequentialIds('move'), clock: fixedClock(NOW), sessionId }),
    remediation: () => null,
    visual: () => null,
  });
}

describe('a child who volunteers personal information', () => {
  it('is never graded as having answered wrongly', () => {
    expect(turnFor(DISCLOSURE, 'middle').decision.graded).toBeNull();
    expect(turnFor(DISCLOSURE, 'middle').plan).toMatchObject({
      kind: 'SAY',
      approach: 'deflect-personal-info',
    });
  });

  it.each(['early', 'middle', 'senior'] as const)(
    'gets reviewed %s-band text with no model call at all',
    async (band) => {
      const complete = neverCalled();

      const resolved = await service(client(complete)).resolve(turnFor(DISCLOSURE, band));

      expect(complete).not.toHaveBeenCalled();
      expect(resolved.moves[0]?.speech?.text).toBeTruthy();
      expect(resolved.privateEvidence).toMatchObject({ responseSource: 'reviewed-fixed' });
    },
  );

  it('is not counted as a fallback: nothing failed', async () => {
    const resolved = await service(client(neverCalled())).resolve(turnFor(DISCLOSURE, 'middle'));

    expect(resolved.privateEvidence).not.toHaveProperty('fallbackReason');
  });

  it('never has the address repeated back to it', async () => {
    const resolved = await service(client(neverCalled())).resolve(turnFor(DISCLOSURE, 'middle'));

    const spoken = resolved.moves.map((move) => move.speech?.text ?? '').join(' ');
    expect(spoken).not.toContain('Maple');
    expect(spoken).not.toContain('14');
  });

  it('marks the turn for redaction before anything is written down', () => {
    expect(turnFor(DISCLOSURE, 'middle').plan.evidence).toMatchObject({
      personalInfoRedacted: true,
    });
  });

  it('still grades a real answer as an answer', () => {
    expect(turnFor('seven', 'middle').plan.kind).not.toBe('SAY');
  });
});
