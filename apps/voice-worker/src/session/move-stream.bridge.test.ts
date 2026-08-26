import { describe, expect, it } from 'vitest';

import {
  PROTOCOL_VERSION,
  sessionIdSchema,
  tutorMoveSchema,
  type VoiceTurnRequest,
  type VoiceTurnResponse,
} from '@aria/shared';

import { createSpeechRenderer } from '@/voice/speech-renderer';

import { createMoveStream } from './move-stream';

import type { BridgeTurn } from './bridge-turn';
import type { VoiceRoomContext } from './session-context';

const SESSION_ID = sessionIdSchema.parse('11111111-1111-4111-8111-111111111111');
const RENDERER = createSpeechRenderer({ ttsModel: 'fishaudio/s2.1-pro', hints: {} });
const ROOM: VoiceRoomContext = {
  sessionId: SESSION_ID,
  connectionEpoch: 1,
  band: 'middle',
  pronunciation: {},
};

/** Records the order the move stream drives the bridge in; that order is the whole contract. */
function fakeBridge(order: string[]): BridgeTurn {
  return {
    observeMove: () => order.push('observeMove'),
    observeSpeechStarted: () => order.push('observeSpeechStarted'),
    cover: () => order.push('cover'),
    turnStarted: () => order.push('turnStarted'),
    firstSpoken: () => order.push('firstSpoken'),
    settle: () => {
      order.push('settle');
      return Promise.resolve();
    },
  };
}

function stream(order: string[], turn: () => Promise<VoiceTurnResponse>) {
  return createMoveStream({
    room: ROOM,
    client: {
      turn: (_sessionId: string, _body: VoiceTurnRequest) => turn(),
      turnStream: async function* () {
        yield { kind: 'TURN_MOVES' as const, turn: await turn() };
      },
    },
    publisher: { publish: () => Promise.resolve() },
    renderer: RENDERER,
    bridge: fakeBridge(order),
    nextId: () => 'event-bridge',
    now: () => new Date('2026-08-25T00:00:00.000Z'),
  });
}

describe('the bridge in the turn path', () => {
  it('covers the gap after the transcript and before the turn goes out', async () => {
    const order: string[] = [];
    const moves = stream(order, () =>
      Promise.resolve(response([move('move-1', 1, 'Four plus three is seven.')])),
    );

    await collect(moves.handleTranscript('seven', 0.94));

    // `cover` before `turnStarted` is the point: the gap opens when the child stops speaking,
    // not when the API gets round to answering.
    expect(order).toEqual(['cover', 'turnStarted', 'settle', 'firstSpoken']);
  });

  it('waits for a playing clip before the first sentence, and only for the first', async () => {
    const order: string[] = [];
    const moves = stream(order, () =>
      Promise.resolve(response([move('move-1', 1, 'One.'), move('move-2', 2, 'Two.')])),
    );

    await collect(moves.handleTranscript('seven', 0.94));

    expect(order.filter((step) => step === 'settle')).toHaveLength(1);
  });

  it('tells the bridge the child started talking again', async () => {
    const order: string[] = [];
    const moves = stream(order, () => Promise.resolve(response([])));

    await collect(moves.speechStarted());

    expect(order).toContain('observeSpeechStarted');
  });

  it('never covers a gap that no transcript opened', async () => {
    const order: string[] = [];
    const moves = stream(order, () => Promise.resolve(response([])));

    await collect(moves.resume());

    expect(order).not.toContain('cover');
  });
});

function move(id: string, serverSeq: number, text: string) {
  return tutorMoveSchema.parse({
    id,
    at: '2026-08-25T00:00:00.000Z',
    protocolVersion: PROTOCOL_VERSION,
    sessionId: SESSION_ID,
    serverSeq,
    generationId: `generation-${id}`,
    kind: 'SAY',
    speech: { text },
    display: [],
    expects: 'none',
  });
}

function response(moves: VoiceTurnResponse['moves']): VoiceTurnResponse {
  return { connectionEpoch: 1, moves };
}

async function collect(values: AsyncIterable<string>): Promise<readonly string[]> {
  const result: string[] = [];
  for await (const value of values) result.push(value);
  return result;
}
