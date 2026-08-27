import { describe, expect, it } from 'vitest';

import { readVoiceWorkerConfig, voiceProfileFor } from '@/config';

const ENV = {
  LIVEKIT_URL: 'https://livekit.example',
  LIVEKIT_API_KEY: 'key',
  LIVEKIT_API_SECRET: 'secret-secret-secret',
  ARIA_API_URL: 'https://api.example',
  VOICE_WORKER_TOKEN: 'token-token-token-token-token-token',
  VOICE_TTS_VOICE_EARLY: 'voice-early',
  VOICE_TTS_VOICE_MIDDLE: 'voice-middle',
  VOICE_TTS_VOICE_SENIOR: 'voice-senior',
} satisfies NodeJS.ProcessEnv;

describe('voice worker configuration', () => {
  it('resolves a named voice for every band', () => {
    const config = readVoiceWorkerConfig(ENV);

    expect(voiceProfileFor(config, 'early').voiceId).toBe('voice-early');
    expect(voiceProfileFor(config, 'senior').voiceId).toBe('voice-senior');
  });

  it('refuses to boot when a band has no voice, rather than defaulting to one', () => {
    const { VOICE_TTS_VOICE_MIDDLE: _omitted, ...missing } = ENV;

    expect(() => readVoiceWorkerConfig(missing)).toThrow(/VOICE_TTS_VOICE_MIDDLE/);
  });

  it('has no "default" voice left to fall back to', () => {
    expect(JSON.stringify(readVoiceWorkerConfig(ENV))).not.toContain('"ttsVoice"');
  });
});
