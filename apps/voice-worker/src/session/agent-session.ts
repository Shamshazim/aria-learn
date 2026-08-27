import { AgentSessionEventTypes, inference, voice } from '@livekit/agents';

import type { TutorMove } from '@aria/shared';
import { endpointingFor } from '@aria/voice';

import { voiceProfileFor, type VoiceWorkerConfig } from '@/config';
import type { VoiceRoomContext } from '@/session/session-context';
import { synthesisOptions } from '@/voice/vendor';

export type AriaAgentSession = voice.AgentSession;

export { AgentSessionEventTypes };

/**
 * P2H-07: the harness may start on a partial transcript, but nothing is ever spoken from a draft.
 *
 * `preemptiveTts: false` is the whole of the safety story here. A draft answer still goes through
 * the API, which releases a sentence only after it passes the gate, so speaking one early would
 * be audible waste rather than a shortcut — and a guess the child hears cannot be taken back.
 */
export const PREEMPTIVE_GENERATION = { enabled: true, preemptiveTts: false } as const;

export function updateEndpointing(
  session: AriaAgentSession,
  room: VoiceRoomContext,
  move: TutorMove,
): void {
  const oralReading = move.kind === 'LISTEN' && move.purpose === 'read_aloud';
  const configured = endpointingFor({ band: room.band, expects: move.expects, oralReading });
  const endpointing = configured ?? { minDelaySeconds: 4, maxDelaySeconds: 4 };
  session.updateOptions({
    turnHandling: {
      endpointing: {
        mode: oralReading ? 'fixed' : 'dynamic',
        minDelay: endpointing.minDelaySeconds * 1_000,
        maxDelay: endpointing.maxDelaySeconds * 1_000,
      },
    },
  });
}

/**
 * P2H-08: one voice for the whole session, chosen by the room's band and never re-chosen.
 *
 * A band is a property of the student, and `VoiceRoomContext` is immutable for the life of a
 * room, so this is a pure function of the two — which is what makes "one voice per session"
 * something a test can assert rather than something a comment claims.
 */
export function ttsOptionsFor(
  config: VoiceWorkerConfig,
  room: VoiceRoomContext,
): Readonly<{
  model: string;
  voice: string;
  language: 'en';
  modelOptions: Readonly<Record<string, unknown>>;
}> {
  const profile = voiceProfileFor(config, room.band);
  return {
    model: config.ttsModel,
    voice: profile.voiceId,
    language: 'en',
    modelOptions: synthesisOptions(config.ttsModel, profile.rate),
  };
}

export function createAgentSession(
  config: VoiceWorkerConfig,
  room: VoiceRoomContext,
): AriaAgentSession {
  const endpointing = endpointingFor({ band: room.band, expects: 'speech', oralReading: false });
  return new voice.AgentSession({
    stt: new inference.STT({ model: config.sttModel, language: 'en' }),
    tts: new inference.TTS(ttsOptionsFor(config, room)),
    turnHandling: {
      turnDetection: new inference.TurnDetector(),
      endpointing:
        endpointing === null
          ? {}
          : {
              mode: 'dynamic',
              minDelay: endpointing.minDelaySeconds * 1_000,
              maxDelay: endpointing.maxDelaySeconds * 1_000,
            },
      interruption: {
        enabled: true,
        mode: 'adaptive',
        minDuration: 300,
        minWords: 1,
        falseInterruptionTimeout: 1_500,
        resumeFalseInterruption: true,
      },
      preemptiveGeneration: PREEMPTIVE_GENERATION,
    },
    // P2H-08: what makes a question sound like a question. P2H-13 measures what it costs in
    // first audio; `voice-review.md` §7 records the escape hatch if a band cannot afford it.
    expressive: true,
  });
}
