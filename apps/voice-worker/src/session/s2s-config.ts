import { z } from 'zod';

/**
 * P2H-15: the speech-to-speech spike is a worker flag, and the flag is the whole rollout.
 *
 * With `VOICE_S2S_PROVIDER` unset the worker is the STT → harness → TTS pipeline and nothing
 * in this module runs. With it set, every session on that worker is carried by the vendor's
 * realtime model — this is a prototype for measurement, so there is no per-session choice
 * and no production path. `voice-s2s-decision.md` records what the measurement found.
 */
export const S2S_PROVIDERS = ['openai', 'google'] as const;
export type S2SProvider = (typeof S2S_PROVIDERS)[number];

/** The vendor defaults the spike is measured against; a model swap is configuration. */
export const S2S_DEFAULT_MODEL: Readonly<Record<S2SProvider, string>> = {
  openai: 'gpt-realtime',
  google: 'gemini-2.5-flash-native-audio-preview-09-2025',
};

export const S2S_DEFAULT_VOICE: Readonly<Record<S2SProvider, string>> = {
  openai: 'marin',
  google: 'Aoede',
};

const KEY_NAME: Readonly<Record<S2SProvider, string>> = {
  openai: 'OPENAI_API_KEY',
  google: 'GOOGLE_API_KEY',
};

const schema = z.object({
  VOICE_S2S_PROVIDER: z.enum(S2S_PROVIDERS).optional(),
  VOICE_S2S_MODEL: z.string().min(1).max(128).optional(),
  VOICE_S2S_VOICE: z.string().min(1).max(64).optional(),
  /** Where the per-turn observations go; unset means the session is not being measured. */
  VOICE_S2S_RUN_LOG: z.string().min(1).max(1024).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  GOOGLE_API_KEY: z.string().min(1).optional(),
});

export type S2SConfig = Readonly<{
  provider: S2SProvider;
  model: string;
  voice: string;
  apiKey: string;
  runLogPath: string | null;
}>;

/** `null` is the pipeline, and is what every existing test and deployment gets. */
export function readS2SConfig(source: NodeJS.ProcessEnv): S2SConfig | null {
  const parsed = schema.parse(source);
  const provider = parsed.VOICE_S2S_PROVIDER;
  if (provider === undefined) return null;
  const keys = { openai: parsed.OPENAI_API_KEY, google: parsed.GOOGLE_API_KEY };
  const apiKey = keys[provider];
  if (apiKey === undefined) {
    // Refused at boot, not at the first child: a session that connects and then cannot open
    // its model is a silent room, which is the one failure a spike must never produce.
    throw new Error(`VOICE_S2S_PROVIDER=${provider} needs ${KEY_NAME[provider]} to be set`);
  }
  return {
    provider,
    model: parsed.VOICE_S2S_MODEL ?? S2S_DEFAULT_MODEL[provider],
    voice: parsed.VOICE_S2S_VOICE ?? S2S_DEFAULT_VOICE[provider],
    apiKey,
    runLogPath: parsed.VOICE_S2S_RUN_LOG ?? null,
  };
}
