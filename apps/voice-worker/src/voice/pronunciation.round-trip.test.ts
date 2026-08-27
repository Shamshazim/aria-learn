import { describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION, sessionIdSchema, type VoiceTurnResponse } from '@aria/shared';

import { createMoveStream } from '@/session/move-stream';
import { parseVoiceRoomContext } from '@/session/session-context';
import { createSpeechRenderer } from '@/voice/speech-renderer';

const SESSION_ID = sessionIdSchema.parse('7a8c7c17-fbb5-4023-bdbc-1a382692293e');

/** Stands in for the synthesis engine: it records the exact text it was asked to say. */
function fakeTts(): Readonly<{ said: string[]; speak(text: string): void }> {
  const said: string[] = [];
  return { said, speak: (text) => said.push(text) };
}

function metadata(pronunciation: Readonly<Record<string, string>>): string {
  // Exactly what the API mints into the participant token (`realtime.service.ts`).
  return JSON.stringify({
    sessionId: SESSION_ID,
    connectionEpoch: 1,
    band: 'early',
    pronunciation: JSON.stringify(pronunciation),
  });
}

function turn(text: string): VoiceTurnResponse {
  return {
    connectionEpoch: 1,
    moves: [
      {
        id: '11111111-1111-4111-8111-111111111111',
        at: '2026-08-25T00:00:00.000Z',
        protocolVersion: PROTOCOL_VERSION,
        kind: 'WELCOME',
        basedOn: [],
        speech: { text },
        display: [{ type: 'text', body: text, markdown: false }],
        expects: 'none',
        serverSeq: 1,
      },
    ],
  };
}

/**
 * P2H-08: from the child's profile to the words the engine is handed.
 *
 * The profile spelling is minted into the participant token by the API, parsed back out here,
 * and applied to the speech only — the move that reaches the screen still says the name the
 * way it is written.
 */
describe('pronunciation round trip', () => {
  it('says the name the way the profile spells it', async () => {
    const tts = fakeTts();
    const published: string[] = [];
    const room = parseVoiceRoomContext(`aria_${SESSION_ID}_1`, metadata({ Siobhan: 'shiv-AWN' }));
    const stream = createMoveStream({
      room,
      client: {
        turn: () => Promise.resolve(turn('Welcome back, Siobhan!')),
        turnStream: async function* () {
          yield await Promise.resolve({
            kind: 'TURN_MOVES' as const,
            turn: turn('Welcome back, Siobhan!'),
          });
        },
      },
      publisher: {
        publish: (move) => {
          published.push(move.speech?.text ?? '');
          return Promise.resolve();
        },
      },
      renderer: createSpeechRenderer({ ttsModel: 'fishaudio/s2.1-pro', hints: room.pronunciation }),
      nextId: () => 'event-1',
      now: () => new Date('2026-08-25T00:00:00.000Z'),
    });

    for await (const text of stream.resume()) tts.speak(text);

    expect(tts.said).toEqual(['Welcome back, shiv-AWN!']);
    expect(published).toEqual(['Welcome back, Siobhan!']);
  });

  it('says the written name when the profile has nothing to add', async () => {
    const tts = fakeTts();
    const room = parseVoiceRoomContext(`aria_${SESSION_ID}_1`, metadata({}));
    const stream = createMoveStream({
      room,
      client: {
        turn: () => Promise.resolve(turn('Welcome back, Siobhan!')),
        turnStream: async function* () {
          yield await Promise.resolve({
            kind: 'TURN_MOVES' as const,
            turn: turn('Welcome back, Siobhan!'),
          });
        },
      },
      publisher: { publish: () => Promise.resolve() },
      renderer: createSpeechRenderer({ ttsModel: 'fishaudio/s2.1-pro', hints: room.pronunciation }),
      nextId: () => 'event-1',
      now: () => new Date('2026-08-25T00:00:00.000Z'),
    });

    for await (const text of stream.resume()) tts.speak(text);

    expect(tts.said).toEqual(['Welcome back, Siobhan!']);
  });
});
