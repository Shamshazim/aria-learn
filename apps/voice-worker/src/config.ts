import { z } from 'zod';

import { BANDS, type Band } from '@aria/shared';

import { readS2SConfig, type S2SConfig } from '@/session/s2s-config';
import { voiceFor, type BandVoiceIds, type VoiceProfile } from '@/voice/voice-catalog';

const voiceId = z.string().min(1).max(128);

/**
 * P2H-08: a voice per band, and no default.
 *
 * `VOICE_TTS_VOICE=default` used to mean "whatever the engine feels like", which is how Aria
 * ended up sounding like a text-to-speech demo in every band. There is no default now: a band
 * without a configured voice fails the worker at boot, loudly, rather than at the first child.
 */
const schema = z.object({
  LIVEKIT_URL: z.url(),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(16),
  ARIA_API_URL: z.url(),
  VOICE_WORKER_TOKEN: z.string().min(32),
  VOICE_STT_MODEL: z.string().min(1).default('assemblyai/universal-3-5-pro'),
  VOICE_TTS_MODEL: z.string().min(1).default('elevenlabs/eleven_turbo_v2_5'),
  VOICE_TTS_VOICE_EARLY: voiceId,
  VOICE_TTS_VOICE_MIDDLE: voiceId,
  VOICE_TTS_VOICE_SENIOR: voiceId,
});

export type VoiceWorkerConfig = Readonly<{
  livekitUrl: string;
  livekitApiKey: string;
  livekitApiSecret: string;
  apiUrl: string;
  workerToken: string;
  sttModel: string;
  ttsModel: string;
  voices: BandVoiceIds;
  /** P2H-15: set only on a worker running the speech-to-speech spike. */
  s2s: S2SConfig | null;
}>;

export function readVoiceWorkerConfig(source: NodeJS.ProcessEnv): VoiceWorkerConfig {
  const parsed = schema.parse(source);
  const voices: BandVoiceIds = {
    early: parsed.VOICE_TTS_VOICE_EARLY,
    middle: parsed.VOICE_TTS_VOICE_MIDDLE,
    senior: parsed.VOICE_TTS_VOICE_SENIOR,
  };
  // Resolved at boot for every band, so a misconfigured band cannot wait for a child in it.
  for (const band of BANDS) voiceFor(band, voices);
  return {
    livekitUrl: parsed.LIVEKIT_URL,
    livekitApiKey: parsed.LIVEKIT_API_KEY,
    livekitApiSecret: parsed.LIVEKIT_API_SECRET,
    apiUrl: parsed.ARIA_API_URL,
    workerToken: parsed.VOICE_WORKER_TOKEN,
    sttModel: parsed.VOICE_STT_MODEL,
    ttsModel: parsed.VOICE_TTS_MODEL,
    voices,
    s2s: readS2SConfig(source),
  };
}

export function voiceProfileFor(config: VoiceWorkerConfig, band: Band): VoiceProfile {
  return voiceFor(band, config.voices);
}
