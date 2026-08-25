import { describe, expect, it, vi } from 'vitest';

import { PROTOCOL_VERSION, tutorInputEventSchema } from '@aria/shared';
import type { PlannedTurn } from '@aria/tutor';

import { createAiClient, type AiClient } from '@/ai';
import type { LlmResponse } from '@/ai/provider';
import { fixedClock } from '@/lib/clock';
import { sequentialIds } from '@/lib/ids';
import { createTurnContentObserver, FALLBACK_USED_TOTAL } from '@/observability/content-metrics';
import { createMetrics } from '@/observability/metrics';
import { scrubLearnerContext } from '@/privacy';
import { createQualityGate } from '@/quality';
import {
  createTurnContentService,
  type ApiModelContext,
} from '@/services/content/turn-content.service';
import { createMoveFactory } from '@/services/moves/move-factory';

const NOW = new Date('2026-08-24T20:00:00.000Z');

function response(text: string): LlmResponse {
  return {
    text: JSON.stringify({ text }),
    endpointName: 'teach-primary',
    model: 'teacher-model',
    tokensIn: 20,
    tokensOut: 8,
    costUsd: 0,
    latencyMs: 1,
    finishReason: 'stop',
  };
}

/** The real client over a fake provider, so prompt name and version are the real ones. */
function clientOver(complete: (request: never) => Promise<LlmResponse>): AiClient {
  return createAiClient({
    provider: {
      complete,
      stream: async function* () {
        yield await Promise.resolve({ kind: 'complete', response: response('') } as const);
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

const aiReturning = (text: string): AiClient =>
  clientOver(vi.fn(() => Promise.resolve(response(text))));

function serviceWith(ai: AiClient | null) {
  const metrics = createMetrics();
  const logger = { warn: vi.fn() };
  const service = createTurnContentService({
    reliable: { resolve: vi.fn() },
    ai,
    gate: createQualityGate(() => ({ safe: true, categories: [] })),
    moves: (sessionId) =>
      createMoveFactory({ ids: sequentialIds('move'), clock: fixedClock(NOW), sessionId }),
    remediation: () => null,
    observer: createTurnContentObserver({ metrics, logger }),
  });
  return { service, metrics, logger };
}

describe('fallback_used_total', () => {
  it('reports ai_disabled when no provider is configured', async () => {
    const { service, metrics } = serviceWith(null);

    await service.resolve(turn());

    expect(metrics.snapshot().counters).toEqual({
      [`${FALLBACK_USED_TOTAL}{move=HINT,reason=ai_disabled}`]: 1,
    });
  });

  it('reports provider_error when every attempt throws', async () => {
    const ai = clientOver(vi.fn(() => Promise.reject(new Error('safe test failure'))));
    const { service, metrics } = serviceWith(ai);

    await service.resolve(turn());

    expect(metrics.snapshot().counters).toEqual({
      [`${FALLBACK_USED_TOTAL}{move=HINT,reason=provider_error}`]: 1,
    });
  });

  it('reports gate_failed when the model answers but the text is off-level', async () => {
    const { service, metrics } = serviceWith(
      aiReturning(
        'Interpret the sophisticated relationship because the argument needs evidence and support.',
      ),
    );

    await service.resolve(turn());

    expect(metrics.snapshot().counters).toEqual({
      [`${FALLBACK_USED_TOTAL}{move=HINT,reason=gate_failed}`]: 1,
    });
  });

  it('records the prompt id and version and never a fallback when generation succeeds', async () => {
    const { service, metrics } = serviceWith(aiReturning('Try counting on from four.'));

    const resolved = await service.resolve(turn());

    expect(metrics.snapshot().counters).toEqual({});
    expect(resolved.privateEvidence).toMatchObject({
      responseSource: 'model',
      promptName: 'respond',
      promptVersion: '1.0.0',
    });
  });
});

function turn(): PlannedTurn<ApiModelContext> {
  const event = tutorInputEventSchema.parse({
    id: 'event-1',
    at: NOW.toISOString(),
    protocolVersion: PROTOCOL_VERSION,
    kind: 'CONFUSED',
  });
  const plan = {
    kind: 'HINT' as const,
    approach: 'single-nudge',
    reason: 'test',
    skillCode: 'ADD.FACT.10',
    attempt: 1,
  };
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
        lastApproach: null,
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
        arithmeticProblem: null,
        completionOnly: false,
        latestAsk: null,
      },
      recentKinds: [],
    },
    decision: {
      allowedMoves: ['HINT'],
      graded: null,
      terminal: false,
      decisive: true,
      reasons: ['test_fixture'],
      defaultPlan: plan,
    },
    plan,
  };
}
