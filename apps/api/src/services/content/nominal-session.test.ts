import { describe, expect, it, vi } from 'vitest';

import { PROTOCOL_VERSION, tutorInputEventSchema, type Band, type MoveKind } from '@aria/shared';
import type { PlannedTurn } from '@aria/tutor';

import { createAiClient, type AiClient } from '@/ai';
import type { LlmResponse } from '@/ai/provider';
import { fixedClock } from '@/lib/clock';
import { sequentialIds } from '@/lib/ids';
import type { TurnContentObserver } from '@/observability/content-metrics';
import { scrubLearnerContext } from '@/privacy';
import { createQualityGate } from '@/quality';
import { createTurnContentService } from '@/services/content/turn-content.service';
import type { ApiModelContext } from '@/services/content/turn-content.types';
import { createMoveFactory } from '@/services/moves/move-factory';

const NOW = new Date('2026-08-25T10:00:00.000Z');

/**
 * P2H-11: a session where nothing is broken never hears a static string.
 *
 * `fallback_used_total` is the bar for this phase, and it is a real bar rather than a metric we
 * happen to emit: every reviewed sentence in `fallback/` is there for an outage. This walks a
 * twenty-turn session — the shape of a real one, questions and answers and an ending — with a
 * model that behaves, and asserts the counter never moves.
 */
describe('a nominal session', () => {
  it('never reaches the reviewed fallback text in twenty turns', async () => {
    const fallbackUsed = vi.fn();
    const service = serviceWith(wellBehavedModel().client, { fallbackUsed });

    for (const [index, kind] of TWENTY_TURNS.entries()) {
      const resolved = await service.resolve(turn(kind, 'middle', index));
      expect(resolved.privateEvidence).toMatchObject({ responseSource: 'model' });
    }

    expect(fallbackUsed).not.toHaveBeenCalled();
  });
});

describe('praise that claims something the child did not do', () => {
  it('is regenerated rather than spoken', async () => {
    const replies = [
      'You counted on from the bigger number there.',
      'You lined up the tens first.',
    ];
    const ai = scriptedModel(replies);
    const fallbackUsed = vi.fn();

    const resolved = await serviceWith(ai.client, { fallbackUsed }).resolve(praiseTurn());

    expect(ai.complete).toHaveBeenCalledTimes(2);
    expect(resolved.moves[0]?.speech?.text).toBe(replies[1]);
    expect(fallbackUsed).not.toHaveBeenCalled();
  });

  it('falls back, and says why, when the model will not stop inventing', async () => {
    const ai = scriptedModel(['Good job. You used the number line.']);
    const fallbackUsed = vi.fn();

    const resolved = await serviceWith(ai.client, { fallbackUsed }).resolve(praiseTurn());

    expect(ai.complete).toHaveBeenCalledTimes(2);
    expect(fallbackUsed).toHaveBeenCalledWith('PRAISE', 'gate_failed');
    expect(resolved.privateEvidence).toMatchObject({
      responseSource: 'fallback',
      fallbackReason: 'gate_failed',
    });
  });
});

/** Twenty turns of a session that is going well: ask, answer, react, and an ending. */
const TWENTY_TURNS: readonly MoveKind[] = [
  'WELCOME',
  'RECOMMEND',
  'PRAISE',
  'HINT',
  'PRAISE',
  'SAY',
  'RETEACH',
  'PRAISE',
  'HINT',
  'REVEAL',
  'SWITCH',
  'PRAISE',
  'SAY',
  'HINT',
  'PRAISE',
  'RETEACH',
  'PRAISE',
  'CHECK_IN',
  'SHOW',
  'END',
];

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

type CapturedRequest = Readonly<{ system: string; user: string }>;

function clientOf(reply: (request: CapturedRequest) => string) {
  const complete = vi.fn((request: CapturedRequest) => Promise.resolve(response(reply(request))));
  const client: AiClient = createAiClient({
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
  return { client, complete };
}

/** A model that says something acceptable for whichever move it was asked for. */
function wellBehavedModel() {
  return clientOf((request) => {
    if (request.user.includes('Your move now: REVEAL')) {
      return 'The answer is 42. Ten and thirty-two make forty-two, because only the tens change.';
    }
    if (request.user.includes('Your move now: END')) {
      return 'You stayed with the hard ones today. See you next time.';
    }
    return 'Let us take the tens first, then the ones.';
  });
}

function scriptedModel(replies: readonly string[]) {
  let index = 0;
  return clientOf(() => {
    const reply = replies[Math.min(index, replies.length - 1)] ?? '';
    index += 1;
    return reply;
  });
}

function serviceWith(ai: AiClient, observer: Partial<TurnContentObserver>) {
  return createTurnContentService({
    reliable: {
      resolve: vi.fn(() =>
        Promise.resolve({
          source: 'fallback' as const,
          itemId: null,
          body: { prompt: 'What is twenty-seven plus fifteen?', answerKey: '42' },
        }),
      ),
    },
    ai,
    gate: createQualityGate(() => ({ safe: true, categories: [] })),
    moves: (sessionId) =>
      createMoveFactory({ ids: sequentialIds('move'), clock: fixedClock(NOW), sessionId }),
    remediation: () => null,
    visual: () => null,
    observer: { fallbackUsed: () => undefined, streamTruncated: () => undefined, ...observer },
  });
}

function praiseTurn(): PlannedTurn<ApiModelContext> {
  const base = turn('PRAISE', 'middle', 0);
  return {
    ...base,
    decision: {
      ...base.decision,
      graded: { correct: true, misconception: null, strategies: ['lined-up-place-value'] },
    },
  };
}

function turn(kind: MoveKind, band: Band, index: number): PlannedTurn<ApiModelContext> {
  const event = tutorInputEventSchema.parse({
    id: `event-${String(index)}`,
    at: NOW.toISOString(),
    protocolVersion: PROTOCOL_VERSION,
    kind: 'CONFUSED',
  });
  const plan = {
    kind,
    approach: 'default',
    reason: 'test',
    skillCode: 'ADD.REGROUP.2D',
    attempt: 1,
  };
  return {
    event,
    plan,
    decision: {
      allowedMoves: [kind],
      graded: null,
      terminal: kind === 'END',
      decisive: true,
      reasons: [],
      defaultPlan: plan,
    },
    context: {
      recentKinds: [],
      session: {
        id: 'session-1',
        studentId: 'student-1',
        subject: 'math',
        grade: '4',
        band,
        skillCode: 'ADD.REGROUP.2D',
        startedAt: NOW,
        attempts: 1,
        consecutiveWrong: 0,
        consecutiveSilences: 0,
        repeatedMisconception: null,
        lastApproach: null,
        unmetPrerequisite: null,
      },
      modelContext: {
        scrubbed: scrubLearnerContext({ identifiers: {}, gradeBand: band }, { pseudonym: 'omit' }),
        answerKey: '42',
        latestQuestion: 'What is twenty-seven plus fifteen?',
        estimatedTokens: 0,
        retrievedFactIds: [],
        recentContentItemIds: [],
        recentIntents: [],
        arithmeticProblem: null,
        lesson: null,
        completionOnly: false,
        latestAsk: null,
      },
    },
  };
}
