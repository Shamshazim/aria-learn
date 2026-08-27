import { describe, expect, it, vi } from 'vitest';

import {
  PROTOCOL_VERSION,
  sessionIdSchema,
  tutorMoveSchema,
  type Band,
  type VoiceTurnRequest,
  type VoiceTurnResponse,
} from '@aria/shared';

import { createSpeechRenderer } from '@/voice/speech-renderer';

import { createMoveStream } from './move-stream';

import type { VoiceRoomContext } from './session-context';

const SESSION_ID = sessionIdSchema.parse('11111111-1111-4111-8111-111111111111');

/** P2H-08: a real renderer against a vendor that renders no markup — the default deployment. */
const RENDERER = createSpeechRenderer({ ttsModel: 'fishaudio/s2.1-pro', hints: {} });

function room(band: Band, connectionEpoch: number): VoiceRoomContext {
  return { sessionId: SESSION_ID, connectionEpoch, band, pronunciation: {} };
}

/**
 * P2H-07: the turn as a stream of sentences, closed by the moves they belonged to.
 *
 * The buffered path is covered in `move-stream.test.ts`; these are the things only a stream can
 * get wrong — speaking a move twice, speaking a sentence the child talked over, and forgetting
 * to tell the API how much of the answer was actually heard.
 */
describe('voice move stream, sentence by sentence', () => {
  it('speaks each sentence as it lands and does not say the move again', async () => {
    const publish = vi.fn(() => Promise.resolve());
    const spoken = move('move-streamed', 1, 'Four plus three is seven. You can count on.');
    const stream = createMoveStream({
      room: room('middle', 1),
      client: {
        turn: () => Promise.reject(new Error('the streaming path is under test')),
        turnStream: async function* () {
          yield await Promise.resolve(segment(0, 'Four plus three is seven.'));
          yield await Promise.resolve(segment(1, 'You can count on.'));
          yield { kind: 'TURN_MOVES' as const, turn: response(1, [spoken]) };
        },
      },
      publisher: { publish },
      renderer: RENDERER,
      nextId: () => 'event-streamed',
      now: () => new Date('2026-08-24T00:00:00.000Z'),
    });

    await expect(collect(stream.resume())).resolves.toEqual([
      'Four plus three is seven.',
      'You can count on.',
    ]);
    // The move is still published: the transcript and the browser need the whole of it.
    expect(publish).toHaveBeenCalledWith(spoken);
  });

  it('drops the sentences of an answer the child talked over', async () => {
    const stream = createMoveStream({
      room: room('middle', 1),
      client: {
        turn: () => Promise.reject(new Error('the streaming path is under test')),
        turnStream: async function* () {
          yield await Promise.resolve(segment(0, 'One.'));
          yield { kind: 'TURN_MOVES' as const, turn: response(1, []) };
        },
      },
      publisher: { publish: () => Promise.resolve() },
      renderer: RENDERER,
      nextId: () => 'event-barge-in',
      now: () => new Date('2026-08-24T00:00:00.000Z'),
    });
    await collect(stream.resume());

    stream.cancelGeneration('generation-streamed');

    expect(stream.activeGenerationId()).toBeNull();
  });

  it('stops the API writing an answer the child talked over', async () => {
    let generationSignal: AbortSignal | undefined;
    const stream = createMoveStream({
      room: room('middle', 1),
      client: {
        turn: () => Promise.reject(new Error('the streaming path is under test')),
        turnStream: async function* (
          _sessionId: string,
          _body: VoiceTurnRequest,
          signal?: AbortSignal,
        ) {
          generationSignal = signal;
          yield await Promise.resolve(segment(0, 'One.'));
          yield { kind: 'TURN_MOVES' as const, turn: response(1, []) };
        },
      },
      publisher: { publish: () => Promise.resolve() },
      renderer: RENDERER,
      nextId: () => 'event-abort',
      now: () => new Date('2026-08-24T00:00:00.000Z'),
    });
    await collect(stream.resume());

    stream.cancelGeneration('generation-streamed');

    expect(generationSignal?.aborted).toBe(true);
  });

  it('replays a move whole when its stream never reached the closing frame', async () => {
    const publish = vi.fn(() => Promise.resolve());
    const half = move('move-streamed', 1, 'One. Two.');
    let attempt = 0;
    const stream = createMoveStream({
      room: room('middle', 1),
      client: {
        turn: () => Promise.reject(new Error('the streaming path is under test')),
        turnStream: async function* () {
          attempt += 1;
          if (attempt === 1) {
            // The connection dropped after one sentence: no closing frame ever arrived.
            yield await Promise.resolve(segment(0, 'One.'));
            throw new Error('safe test failure: the stream stopped');
          }
          // The outbox still has the move, and the child has heard only half of it.
          yield { kind: 'TURN_MOVES' as const, turn: response(1, [half]) };
        },
      },
      publisher: { publish },
      renderer: RENDERER,
      nextId: () => 'event-partial',
      now: () => new Date('2026-08-24T00:00:00.000Z'),
    });

    await expect(collect(stream.resume())).rejects.toThrow(/the stream stopped/u);

    await expect(collect(stream.resume())).resolves.toEqual(['One. Two.']);
    expect(publish).toHaveBeenCalledWith(half);
  });

  it('tells the API how far into the interrupted answer the child got', async () => {
    const turnStream = vi.fn(async function* (_sessionId: string, _body: VoiceTurnRequest) {
      yield await Promise.resolve(segment(0, 'One.'));
      yield await Promise.resolve(segment(1, 'Two.'));
      yield { kind: 'TURN_MOVES' as const, turn: response(1, []) };
    });
    const stream = createMoveStream({
      room: room('middle', 1),
      client: { turn: () => Promise.resolve(response(1, [])), turnStream },
      publisher: { publish: () => Promise.resolve() },
      renderer: RENDERER,
      nextId: () => 'event-prefix',
      now: () => new Date('2026-08-24T00:00:00.000Z'),
    });
    await collect(stream.resume());
    stream.cancelGeneration('generation-streamed');

    await collect(stream.handleTranscript('wait', 0.9));

    expect(turnStream.mock.calls.at(-1)?.[1]).toEqual(
      expect.objectContaining({ spokenPrefix: { generationId: 'generation-streamed', index: 1 } }),
    );
  });
});

function segment(index: number, text: string) {
  return {
    kind: 'MOVE_SEGMENT' as const,
    generationId: 'generation-streamed',
    moveId: 'move-streamed',
    index,
    text,
    speech: text,
    isLast: false,
  };
}

function move(id: string, serverSeq: number, text: string) {
  return tutorMoveSchema.parse({
    id,
    at: '2026-08-24T00:00:00.000Z',
    protocolVersion: PROTOCOL_VERSION,
    sessionId: SESSION_ID,
    serverSeq,
    generationId: 'generation-streamed',
    kind: 'SAY',
    speech: { text },
    display: [],
    expects: 'none',
  });
}

function response(connectionEpoch: number, moves: VoiceTurnResponse['moves']): VoiceTurnResponse {
  return { connectionEpoch, moves };
}

async function collect(values: AsyncIterable<string>): Promise<readonly string[]> {
  const result: string[] = [];
  for await (const value of values) result.push(value);
  return result;
}
