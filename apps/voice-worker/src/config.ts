import { z } from 'zod';

const schema = z.object({
  LIVEKIT_URL: z.url(),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(16),
  ARIA_API_URL: z.url(),
  VOICE_WORKER_TOKEN: z.string().min(32),
  VOICE_STT_MODEL: z.string().min(1).default('assemblyai/universal-3-5-pro'),
  VOICE_TTS_MODEL: z.string().min(1).default('fishaudio/s2.1-pro'),
  VOICE_TTS_VOICE: z.string().min(1).default('default'),
});

export type VoiceWorkerConfig = Readonly<{
  livekitUrl: string;
  livekitApiKey: string;
  livekitApiSecret: string;
  apiUrl: string;
  workerToken: string;
  sttModel: string;
  ttsModel: string;
  ttsVoice: string;
}>;

export function readVoiceWorkerConfig(source: NodeJS.ProcessEnv): VoiceWorkerConfig {
  const parsed = schema.parse(source);
  return {
    livekitUrl: parsed.LIVEKIT_URL,
    livekitApiKey: parsed.LIVEKIT_API_KEY,
    livekitApiSecret: parsed.LIVEKIT_API_SECRET,
    apiUrl: parsed.ARIA_API_URL,
    workerToken: parsed.VOICE_WORKER_TOKEN,
    sttModel: parsed.VOICE_STT_MODEL,
    ttsModel: parsed.VOICE_TTS_MODEL,
    ttsVoice: parsed.VOICE_TTS_VOICE,
  };
}
