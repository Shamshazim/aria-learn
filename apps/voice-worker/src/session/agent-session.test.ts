import { describe, expect, it } from 'vitest';

import { sessionIdSchema, type Band } from '@aria/shared';

import { readVoiceWorkerConfig } from '@/config';
import { ttsOptionsFor } from '@/session/agent-session';
import type { VoiceRoomContext } from '@/session/session-context';

const config = readVoiceWorkerConfig({
  LIVEKIT_URL: 'https://livekit.example',
  LIVEKIT_API_KEY: 'key',
  LIVEKIT_API_SECRET: 'secret-secret-secret',
  ARIA_API_URL: 'https://api.example',
  VOICE_WORKER_TOKEN: 'token-token-token-token-token-token',
  VOICE_TTS_MODEL: 'fishaudio/s2.1-pro',
  VOICE_TTS_VOICE_EARLY: 'voice-early',
  VOICE_TTS_VOICE_MIDDLE: 'voice-middle',
  VOICE_TTS_VOICE_SENIOR: 'voice-senior',
});

function room(band: Band): VoiceRoomContext {
  return {
    sessionId: sessionIdSchema.parse('7a8c7c17-fbb5-4023-bdbc-1a382692293e'),
    connectionEpoch: 1,
    band,
    pronunciation: {},
  };
}

describe('the session voice', () => {
  /** The ticket's edge case: a band cannot change mid-session, so neither can the voice. */
  it('is one voice for the whole session, however often it is asked for', () => {
    const early = room('early');

    expect(ttsOptionsFor(config, early)).toEqual(ttsOptionsFor(config, early));
    expect(ttsOptionsFor(config, early).voice).toBe('voice-early');
  });

  it('comes from the room band and from nothing else', () => {
    expect(ttsOptionsFor(config, room('senior')).voice).toBe('voice-senior');
    expect(ttsOptionsFor(config, room('middle')).voice).toBe('voice-middle');
  });

  it('reads to the youngest children more slowly', () => {
    expect(ttsOptionsFor(config, room('early')).modelOptions).toEqual({ speed: 0.92 });
    expect(ttsOptionsFor(config, room('senior')).modelOptions).toEqual({});
  });
});
