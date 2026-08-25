import { AgentSessionEventTypes, inference, voice } from '@livekit/agents';

import type { TutorMove } from '@aria/shared';
import { endpointingFor } from '@aria/voice';

import type { VoiceWorkerConfig } from '@/config';
import type { VoiceRoomContext } from '@/session/session-context';

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

export function createAgentSession(
  config: VoiceWorkerConfig,
  room: VoiceRoomContext,
): AriaAgentSession {
  const endpointing = endpointingFor({ band: room.band, expects: 'speech', oralReading: false });
  return new voice.AgentSession({
    stt: new inference.STT({ model: config.sttModel, language: 'en' }),
    tts: new inference.TTS({ model: config.ttsModel, voice: config.ttsVoice, language: 'en' }),
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
    expressive: false,
  });
}
