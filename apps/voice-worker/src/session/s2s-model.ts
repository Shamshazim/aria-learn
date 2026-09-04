import type { S2SConfig } from '@/session/s2s-config';

import type { llm } from '@livekit/agents';

/**
 * P2H-15: one realtime model per session, from the vendor the flag names.
 *
 * The plugins are imported lazily so a pipeline worker never loads either vendor's SDK: with
 * the flag unset this module is not reached, and the pipeline's dependency surface is what it
 * was. Vendor VAD is left on — the spike is about what native turn-taking sounds like — and
 * both input and output transcription are requested because the safety tap and the metrics
 * need the words, not only the audio.
 */
export async function createRealtimeModel(config: S2SConfig): Promise<llm.RealtimeModel> {
  if (config.provider === 'openai') {
    const openai = await import('@livekit/agents-plugin-openai');
    return new openai.realtime.RealtimeModel({
      model: config.model,
      voice: config.voice,
      apiKey: config.apiKey,
      modalities: ['text', 'audio'],
      inputAudioTranscription: { model: 'gpt-4o-mini-transcribe' },
    });
  }
  const google = await import('@livekit/agents-plugin-google');
  const { Modality } = await import('@google/genai');
  return new google.realtime.RealtimeModel({
    model: config.model,
    voice: config.voice,
    apiKey: config.apiKey,
    modalities: [Modality.AUDIO],
    inputAudioTranscription: {},
    outputAudioTranscription: {},
  });
}
