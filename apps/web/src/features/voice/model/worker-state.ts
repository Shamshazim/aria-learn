import type { VoiceWorkerState } from '@aria/shared';

import type { VoiceState } from '@/features/voice/model/voice-state';
import { publishClientEvent } from '@/features/voice/model/voice-transport';
import { workerReadyAcknowledgement } from '@/features/voice/model/worker-ready';

import type { Room } from 'livekit-client';

export type WorkerStateInput = Readonly<{
  enabled: boolean;
  acknowledgedSeq(): number;
  setState: React.Dispatch<React.SetStateAction<VoiceState>>;
  /** `SPEECH_FINISHED`: the worker's playback cursor, to acknowledge and store. */
  acknowledgeDelivered(serverSeq: number): void;
}>;

/** What each thing the worker says about itself does to the voice state on screen. */
export function applyWorkerState(room: Room, state: VoiceWorkerState, input: WorkerStateInput): void {
  switch (state.kind) {
    case 'WORKER_READY': {
      const acknowledgement = workerReadyAcknowledgement(state, input.enabled, input.acknowledgedSeq());
      if (acknowledgement !== null) {
        void publishClientEvent(room, acknowledgement).catch(() => undefined);
      }
      input.setState((current) => ({
        ...current,
        talks: state.talks,
        status: statusWhenReady(room, input.enabled),
      }));
      return;
    }
    case 'METRICS_UNAVAILABLE':
      return;
    case 'SPEECH_FINISHED':
      input.acknowledgeDelivered(state.acknowledgedSeq);
      return;
    case 'CAPTION':
      input.setState((current) => ({ ...current, caption: state.text }));
      return;
    case 'HEARD':
      input.setState((current) => ({ ...current, heard: state.text }));
      return;
    case 'TRANSCRIPT_UNCLEAR':
      input.setState((current) => ({
        ...current,
        caption: "I didn't catch that. Please try again.",
        status: current.status === 'muted' ? 'muted' : 'listening',
      }));
      return;
    default:
      return assertNever(state);
  }
}

export function statusWhenReady(room: Room, enabled: boolean): VoiceState['status'] {
  if (!enabled) return 'ready';
  return room.localParticipant.isMicrophoneEnabled ? 'listening' : 'muted';
}

function assertNever(value: never): never {
  throw new Error(`Unhandled worker state: ${String(value)}`);
}
