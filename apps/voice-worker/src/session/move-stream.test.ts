import { describe, expect, it, vi } from 'vitest';

import {
  PROTOCOL_VERSION,
  sessionIdSchema,
  tutorMoveSchema,
  type VoiceTurnRequest,
  type VoiceTurnResponse,
} from '@aria/shared';

import { createMoveStream } from './move-stream';

const SESSION_ID = sessionIdSchema.parse('11111111-1111-4111-8111-111111111111');

type Turn = (
  sessionId: string,
  body: VoiceTurnRequest,
  signal?: AbortSignal,
) => Promise<VoiceTurnResponse>;

/**
 * A control plane that answers in one frame. P2H-07 made the turn a stream, and a buffered
 * answer is still a stream — one that goes straight to its closing frame — so every assertion
 * about moves, epochs and acknowledgement cursors stays exactly what it was.
 */
function client(turn: Turn) {
  return {
    turn,
    turnStream: async function* (sessionId: string, body: VoiceTurnRequest, signal?: AbortSignal) {
      yield { kind: 'TURN_MOVES' as const, turn: await turn(sessionId, body, signal) };
    },
  };
}

describe('voice move stream', () => {
  it('speaks only server-gated move text and carries the acknowledgement cursor forward', async () => {
    const publish = vi.fn(() => Promise.resolve());
    const turn = vi.fn(() =>
      Promise.resolve(response(1, [move('move-1', 4, 'Try four plus three.')])),
    );
    const stream = createMoveStream({
      room: { sessionId: SESSION_ID, connectionEpoch: 1, band: 'early' },
      client: client(turn),
      publisher: { publish },
      nextId: () => 'event-1',
      now: () => new Date('2026-08-24T00:00:00.000Z'),
    });

    await expect(collect(stream.resume())).resolves.toEqual(['Try four plus three.']);
    expect(turn).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({ replayOnly: true }),
      expect.any(AbortSignal),
    );
    expect(publish).toHaveBeenCalledOnce();
    expect(stream.acknowledgedSeq()).toBe(0);
    expect(stream.activeGenerationId()).toBe('generation-move-1');

    stream.acceptAcknowledgement(7);
    await collect(stream.handleTranscript('seven', 0.92));
    expect(turn).toHaveBeenLastCalledWith(
      SESSION_ID,
      expect.objectContaining({ acknowledgedSeq: 7, connectionEpoch: 1 }),
      expect.any(AbortSignal),
    );

    stream.clearGeneration();
    await collect(stream.handleTranscript('okay', 0.99));
    expect(turn).toHaveBeenLastCalledWith(
      SESSION_ID,
      expect.objectContaining({ replayOnly: false }),
      expect.any(AbortSignal),
    );
    expect(JSON.stringify(turn.mock.calls.at(-1))).toContain('"kind":"SPEECH_FINAL"');
    expect(JSON.stringify(turn.mock.calls.at(-1))).toContain('"text":"okay"');
  });

  it('publishes a silent move without sending text to TTS', async () => {
    const silent = tutorMoveSchema.parse({
      id: 'move-silent',
      at: '2026-08-24T00:00:00.000Z',
      protocolVersion: PROTOCOL_VERSION,
      sessionId: SESSION_ID,
      serverSeq: 1,
      kind: 'SHOW',
      speech: null,
      display: [{ type: 'text', body: 'Look here.' }],
      expects: 'none',
    });
    const publish = vi.fn(() => Promise.resolve());
    const stream = createMoveStream({
      room: { sessionId: SESSION_ID, connectionEpoch: 2, band: 'middle' },
      client: client(() => Promise.resolve(response(2, [silent]))),
      publisher: { publish },
      nextId: () => 'event-2',
      now: () => new Date('2026-08-24T00:00:00.000Z'),
    });

    await expect(collect(stream.resume())).resolves.toEqual([]);
    expect(publish).toHaveBeenCalledWith(silent);
    expect(stream.activeGenerationId()).toBeNull();
  });

  it('rejects a response from an old connection epoch', async () => {
    const stream = createMoveStream({
      room: { sessionId: SESSION_ID, connectionEpoch: 3, band: 'senior' },
      client: client(() => Promise.resolve(response(2, []))),
      publisher: { publish: () => Promise.resolve() },
      nextId: () => 'event-3',
      now: () => new Date('2026-08-24T00:00:00.000Z'),
    });

    await expect(collect(stream.resume())).rejects.toThrow(/stale voice connection epoch/);
  });

  it('authorizes without queueing old speech, then replays from the browser cursor', async () => {
    const publish = vi.fn(() => Promise.resolve());
    const turn = vi
      .fn()
      .mockResolvedValueOnce(response(4, [move('already-heard', 3, 'Old speech.')]))
      .mockResolvedValueOnce(response(4, [move('new-move', 8, 'New speech.')]));
    const stream = createMoveStream({
      room: { sessionId: SESSION_ID, connectionEpoch: 4, band: 'middle' },
      client: client(turn),
      publisher: { publish },
      nextId: () => 'event-reconnect',
      now: () => new Date('2026-08-24T00:00:00.000Z'),
    });

    await stream.authorize();
    expect(publish).not.toHaveBeenCalled();
    expect(turn.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ authorizeOnly: true }));
    stream.acceptAcknowledgement(7);
    await expect(collect(stream.resume())).resolves.toEqual(['New speech.']);
    expect(turn.mock.calls[1]?.[1]).toEqual(expect.objectContaining({ acknowledgedSeq: 7 }));
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-move' }));
  });

  it('logs a backchannel without grading it as a spoken answer', async () => {
    const turn = vi.fn(() => Promise.resolve(response(1, [move('move-1', 1, 'Keep going.')])));
    const stream = createMoveStream({
      room: { sessionId: SESSION_ID, connectionEpoch: 1, band: 'early' },
      client: client(turn),
      publisher: { publish: () => Promise.resolve() },
      nextId: () => 'event-backchannel',
      now: () => new Date('2026-08-24T00:00:00.000Z'),
    });
    await collect(stream.resume());

    await collect(stream.handleTranscript('okay', 0.99));

    expect(turn).toHaveBeenLastCalledWith(
      SESSION_ID,
      expect.objectContaining({ replayOnly: false }),
      expect.any(AbortSignal),
    );
    expect(JSON.stringify(turn.mock.calls.at(-1))).toContain('"kind":"BACKCHANNEL"');
  });

  it('observes speech starting without consuming pending tutor output', async () => {
    const pending = move('move-pending', 1, 'Take your time.');
    const publish = vi.fn(() => Promise.resolve());
    const turn = vi.fn(() => Promise.resolve(response(1, [pending])));
    const stream = createMoveStream({
      room: { sessionId: SESSION_ID, connectionEpoch: 1, band: 'early' },
      client: client(turn),
      publisher: { publish },
      nextId: () => 'event-speech-started',
      now: () => new Date('2026-08-24T00:00:00.000Z'),
    });

    await expect(collect(stream.speechStarted())).resolves.toEqual([]);
    expect(publish).not.toHaveBeenCalled();
    expect(JSON.stringify(turn.mock.calls[0])).toContain('"kind":"SPEECH_STARTED"');

    await expect(collect(stream.resume())).resolves.toEqual(['Take your time.']);
    expect(publish).toHaveBeenCalledWith(pending);
  });

  it('tracks whether a terminal move needs speech before shutdown', async () => {
    const terminal = tutorMoveSchema.parse({
      ...move('move-terminal', 1, 'See you next time.'),
      kind: 'END',
    });
    const stream = createMoveStream({
      room: { sessionId: SESSION_ID, connectionEpoch: 1, band: 'early' },
      client: client(() => Promise.resolve(response(1, [terminal]))),
      publisher: { publish: () => Promise.resolve() },
      nextId: () => 'event-terminal',
      now: () => new Date('2026-08-24T00:00:00.000Z'),
    });

    await expect(collect(stream.resume())).resolves.toEqual(['See you next time.']);
    expect(stream.terminalDelivered()).toBe(true);
    expect(stream.terminalSpeechPending()).toBe(true);
    expect(stream.takePendingPlaybackSeq()).toBe(1);
    expect(stream.takePendingPlaybackSeq()).toBe(0);
  });
});

function move(id: string, serverSeq: number, text: string) {
  return tutorMoveSchema.parse({
    id,
    at: '2026-08-24T00:00:00.000Z',
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

function response(connectionEpoch: number, moves: VoiceTurnResponse['moves']): VoiceTurnResponse {
  return { connectionEpoch, moves };
}

async function collect(values: AsyncIterable<string>): Promise<readonly string[]> {
  const result: string[] = [];
  for await (const value of values) result.push(value);
  return result;
}
