import { describe, expect, it, vi } from 'vitest';

import { PROTOCOL_VERSION, tutorInputEventSchema, type Band, type MoveKind } from '@aria/shared';
import type { PlannedTurn } from '@aria/tutor';

import type { GatedSegment, RespondStreamer } from '@/ai';
import { fixedClock } from '@/lib/clock';
import { sequentialIds } from '@/lib/ids';
import { scrubLearnerContext } from '@/privacy';
import { createQualityGate } from '@/quality';
import { createSegmentBus } from '@/services/content/segment-bus';
import {
  createTurnContentService,
  type ApiModelContext,
} from '@/services/content/turn-content.service';
import { createMoveFactory } from '@/services/moves/move-factory';

const NOW = new Date('2026-08-24T20:00:00.000Z');

const FOUR_SENTENCES = [
  'Four plus three is seven.',
  'You can count on from four.',
  'Five, six, seven.',
  'That is the whole idea.',
];

/**
 * A streamer that has already done its job: these sentences passed the gate (P2H-07).
 *
 * What the gate does to a stream is proved where the stream lives — `ai/streaming` — and what
 * matters here is what the turn does with what comes out of it: who the sentences belong to,
 * which moves get to have them, and whether anyone was listening.
 */
function scriptedStreamer(sentences: readonly string[] = FOUR_SENTENCES): RespondStreamer {
  return {
    stream: () =>
      (async function* () {
        for (const [index, written] of sentences.entries()) {
          yield await Promise.resolve({
            written,
            spoken: written,
            gateMs: 0,
            index,
            isLast: index === sentences.length - 1,
          });
        }
      })(),
  };
}

function streamingService(
  segments: ReturnType<typeof createSegmentBus>,
  respond: RespondStreamer = scriptedStreamer(),
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
    respond,
    segments,
    ids: sequentialIds('stream'),
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

  it.each(['ASK', 'HINT'] as const)('never streams %s: an item is checked whole', async (kind) => {
    const segments = createSegmentBus();
    const collected = heard(segments);

    await streamingService(segments).resolve(turn(kind, 'middle'));

    expect(collected).toEqual([]);
  });

  it('never streams the early band, whose register rule is a whole-answer rule', async () => {
    const segments = createSegmentBus();
    const collected = heard(segments);

    await streamingService(segments).resolve(turn('SAY', 'early'));

    expect(collected).toEqual([]);
  });

  it('does not generate into nothing when no client is listening', async () => {
    const segments = createSegmentBus();
    const scripted = scriptedStreamer();
    const respond: RespondStreamer = { stream: vi.fn(scripted.stream) };

    await streamingService(segments, respond).resolve(turn('SAY', 'middle'));

    expect(respond.stream).not.toHaveBeenCalled();
  });

  it('falls back to a reviewed sentence when the stream produced nothing at all', async () => {
    const segments = createSegmentBus();
    heard(segments);

    const resolved = await streamingService(segments, scriptedStreamer([])).resolve(
      turn('SAY', 'middle'),
    );

    expect(resolved.moves[0]?.speech?.text).toBe(
      'Good thinking to ask. We can find out together as we go.',
    );
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
