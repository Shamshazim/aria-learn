import { describe, expect, it, vi } from 'vitest';

import { PROTOCOL_VERSION, tutorInputEventSchema, type Band, type MoveKind } from '@aria/shared';
import type { PlannedTurn } from '@aria/tutor';

import type { GatedSegment, RespondStreamer } from '@/ai';
import { fixedClock } from '@/lib/clock';
import { sequentialIds } from '@/lib/ids';
import {
  NULL_TURN_CONTENT_OBSERVER,
  type TurnContentObserver,
} from '@/observability/content-metrics';
import { scrubLearnerContext } from '@/privacy';
import { createQualityGate } from '@/quality';
import {
  failingAfter,
  FOUR_SENTENCES,
  scriptedStreamer,
  substitutingAfter,
} from '@/services/content/__fixtures__/streamers.fixture';
import { ANSWER_QUESTION_FALLBACKS } from '@/services/content/fallback/say.data';
import { createSegmentBus } from '@/services/content/segment-bus';
import {
  createTurnContentService,
  type ApiModelContext,
} from '@/services/content/turn-content.service';
import { createMoveFactory } from '@/services/moves/move-factory';

const NOW = new Date('2026-08-24T20:00:00.000Z');

function streamingService(
  segments: ReturnType<typeof createSegmentBus>,
  respond: RespondStreamer = scriptedStreamer(),
  observer?: Partial<TurnContentObserver>,
) {
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
    visual: () => null,
    streaming: { respond, segments, ids: sequentialIds('stream') },
    ...(observer === undefined ? {} : { observer: { ...NULL_TURN_CONTENT_OBSERVER, ...observer } }),
  });
}

function heard(segments: ReturnType<typeof createSegmentBus>): GatedSegment[] {
  const collected: GatedSegment[] = [];
  segments.subscribe('session-1', (segment) => collected.push(segment));
  return collected;
}

describe('a move that is said while it is written', () => {
  it('publishes every sentence, in order, under one generation', async () => {
    const segments = createSegmentBus();
    const collected = heard(segments);

    await streamingService(segments).resolve(turn('SAY', 'middle'));

    expect(collected.map((segment) => segment.text)).toEqual(FOUR_SENTENCES);
    expect(collected.map((segment) => segment.index)).toEqual([0, 1, 2, 3]);
    expect(new Set(collected.map((segment) => segment.generationId)).size).toBe(1);
  });

  it('names the move its sentences belong to, so nobody says them twice', async () => {
    const segments = createSegmentBus();
    const collected = heard(segments);

    const resolved = await streamingService(segments).resolve(turn('SAY', 'middle'));

    const move = resolved.moves[0];
    expect(move?.speech?.text).toBe(FOUR_SENTENCES.join(' '));
    expect(move?.id).toBe(collected[0]?.moveId);
    expect(move?.generationId).toBe(collected[0]?.generationId);
  });

  it('never publishes an ASK: its words come from the bank, not from Aria', async () => {
    const segments = createSegmentBus();
    const collected = heard(segments);

    await streamingService(segments).resolve(turn('ASK', 'middle'));

    expect(collected).toEqual([]);
  });

  it('sends a HINT as exactly one segment, because half a hint is a different hint', async () => {
    const segments = createSegmentBus();
    const collected = heard(segments);

    await streamingService(segments).resolve(turn('HINT', 'middle'));

    expect(collected).toHaveLength(1);
    expect(collected[0]).toMatchObject({ index: 0, isLast: true });
  });

  it('sends the early band one segment, because its register rule judges the whole answer', async () => {
    const segments = createSegmentBus();
    const collected = heard(segments);

    await streamingService(segments).resolve(turn('SAY', 'early'));

    expect(collected).toHaveLength(1);
    expect(collected[0]?.text).toBe(FOUR_SENTENCES.join(' '));
    expect(collected[0]?.isLast).toBe(true);
  });

  it('does not generate into nothing when no client is listening', async () => {
    const segments = createSegmentBus();
    const scripted = scriptedStreamer();
    const respond: RespondStreamer = { stream: vi.fn(scripted.stream) };

    await streamingService(segments, respond).resolve(turn('SAY', 'middle'));

    expect(respond.stream).not.toHaveBeenCalled();
  });

  it('records a stream that stopped after the child had already heard some of it', async () => {
    const segments = createSegmentBus();
    const collected = heard(segments);
    const streamTruncated = vi.fn();
    const service = streamingService(segments, failingAfter(2), { streamTruncated });

    const resolved = await service.resolve(turn('SAY', 'middle'));

    expect(collected).toHaveLength(2);
    // The two sentences the child heard were Aria's own, so the move keeps them...
    expect(resolved.moves[0]?.speech?.text).toBe(FOUR_SENTENCES.slice(0, 2).join(' '));
    // ...and the evidence says plainly that the rest never came.
    expect(resolved.privateEvidence).toMatchObject({
      responseSource: 'model',
      streamTruncated: 'provider_error',
    });
    expect(streamTruncated).toHaveBeenCalledWith('SAY', 'provider_error', expect.any(Error));
  });

  /**
   * P2H-11: the static-text policy says no static string reaches a child unless generation and
   * the cache both failed, *and that it is logged*. A stream that ends on the reviewed sentence
   * used to come back as `responseSource: 'model'` with the counter untouched — most of the
   * answer having been Aria's own does not make the last sentence not have happened.
   */
  it('counts the reviewed sentence a stream ended on', async () => {
    const segments = createSegmentBus();
    heard(segments);
    const fallbackUsed = vi.fn();

    const resolved = await streamingService(segments, substitutingAfter(2), {
      fallbackUsed,
    }).resolve(turn('SAY', 'middle'));

    expect(fallbackUsed).toHaveBeenCalledWith('SAY', 'gate_failed');
    expect(resolved.privateEvidence).toMatchObject({
      responseSource: 'model-with-fallback-tail',
    });
  });

  it('falls back to a reviewed sentence when the stream produced nothing at all', async () => {
    const segments = createSegmentBus();
    heard(segments);

    const resolved = await streamingService(segments, scriptedStreamer([])).resolve(
      turn('SAY', 'middle'),
    );

    expect(ANSWER_QUESTION_FALLBACKS.middle).toContain(resolved.moves[0]?.speech?.text);
  });
});

function turn(kind: MoveKind, band: Band): PlannedTurn<ApiModelContext> {
  const plan = {
    kind,
    approach: kind === 'SAY' ? 'answer-question' : 'different-way',
    reason: 'test',
    skillCode: kind === 'ASK' ? 'ADD.FACT.10' : null,
    attempt: 1,
  };
  return {
    event: tutorInputEventSchema.parse({
      id: 'event-1',
      at: NOW.toISOString(),
      protocolVersion: PROTOCOL_VERSION,
      kind: 'QUESTION',
      text: 'why does that work?',
    }),
    context: {
      session: {
        id: 'session-1',
        studentId: 'student-1',
        subject: 'math',
        grade: band === 'early' ? '1' : '4',
        band,
        skillCode: 'ADD.FACT.10',
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
    },
    decision: {
      allowedMoves: [kind],
      graded: null,
      terminal: false,
      decisive: true,
      reasons: ['test_fixture'],
      defaultPlan: plan,
    },
    plan,
  };
}
