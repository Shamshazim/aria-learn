import { describe, expect, it } from 'vitest';

import { readVoiceWorkerConfig } from '@/config';
import { readS2SConfig } from '@/session/s2s-config';

const pipelineEnv = {
  LIVEKIT_URL: 'https://livekit.example',
  LIVEKIT_API_KEY: 'key',
  LIVEKIT_API_SECRET: 'secret-secret-secret',
  ARIA_API_URL: 'https://api.example',
  VOICE_WORKER_TOKEN: 'token-token-token-token-token-token',
  VOICE_TTS_VOICE_EARLY: 'voice-early',
  VOICE_TTS_VOICE_MIDDLE: 'voice-middle',
  VOICE_TTS_VOICE_SENIOR: 'voice-senior',
};

describe('the speech-to-speech flag', () => {
  /** The acceptance criterion: with the flag unset, the pipeline is untouched. */
  it('is off unless VOICE_S2S_PROVIDER is set, and the worker config says so', () => {
    expect(readS2SConfig({})).toBeNull();
    expect(readVoiceWorkerConfig(pipelineEnv).s2s).toBeNull();
  });

  it('picks the vendor defaults for a bare provider', () => {
    expect(readS2SConfig({ VOICE_S2S_PROVIDER: 'openai', OPENAI_API_KEY: 'sk' })).toEqual({
      provider: 'openai',
      model: 'gpt-realtime',
      voice: 'marin',
      apiKey: 'sk',
      runLogPath: null,
    });
    expect(readS2SConfig({ VOICE_S2S_PROVIDER: 'google', GOOGLE_API_KEY: 'g' })).toMatchObject({
      provider: 'google',
      voice: 'Aoede',
    });
  });

  it('lets a run name its model, voice and log', () => {
    expect(
      readS2SConfig({
        VOICE_S2S_PROVIDER: 'openai',
        OPENAI_API_KEY: 'sk',
        VOICE_S2S_MODEL: 'gpt-realtime-mini',
        VOICE_S2S_VOICE: 'cedar',
        VOICE_S2S_RUN_LOG: '/tmp/s2s.jsonl',
      }),
    ).toMatchObject({ model: 'gpt-realtime-mini', voice: 'cedar', runLogPath: '/tmp/s2s.jsonl' });
  });

  it('refuses to boot a provider whose key is missing', () => {
    expect(() => readS2SConfig({ VOICE_S2S_PROVIDER: 'openai' })).toThrow('OPENAI_API_KEY');
    expect(() => readS2SConfig({ VOICE_S2S_PROVIDER: 'google', OPENAI_API_KEY: 'sk' })).toThrow(
      'GOOGLE_API_KEY',
    );
  });

  it('rejects a vendor the spike does not cover', () => {
    expect(() => readS2SConfig({ VOICE_S2S_PROVIDER: 'anthropic' })).toThrow();
  });
});
