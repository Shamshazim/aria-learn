import { type Room, Track } from 'livekit-client';
import { useCallback } from 'react';

import { setRemoteVolume, startVad } from '@/features/voice/model/voice-audio';
import type { VoiceState } from '@/features/voice/model/voice-state';
import { publishAcknowledgement, publishClientEvent } from '@/features/voice/model/voice-transport';
import type { TurnTimingReporter } from '@/lib/observability/timing';

export type VoiceActions = Readonly<{
  enable(): Promise<void>;
  mute(): Promise<void>;
  stopAria(): Promise<void>;
  chooseDevice(deviceId: string): Promise<void>;
  toggleCaptions(): void;
}>;

type VoiceActionRefs = Readonly<{
  room: React.RefObject<Room | null>;
  generation: React.RefObject<string | null>;
  enabled: React.RefObject<boolean>;
  acknowledgedSeq: React.RefObject<number>;
  vad: Readonly<{
    current(): (() => void) | null;
    set(cleanup: (() => void) | null): void;
  }>;
  setState: React.Dispatch<React.SetStateAction<VoiceState>>;
  /** X-04: where the two client-only §11 bars are measured. Absent in a scripted session. */
  timings?: TurnTimingReporter;
}>;

export function useVoiceActions(refs: VoiceActionRefs): VoiceActions {
  const { room, generation, setState } = refs;
  const enable = useCallback(() => enableVoice(refs), []);
  const mute = useCallback(async () => {
    const activeRoom = room.current;
    if (activeRoom === null) return;
    if (activeRoom.localParticipant.getTrackPublication(Track.Source.Microphone) === undefined)
      return;
    const microphoneEnabled = activeRoom.localParticipant.isMicrophoneEnabled;
    await activeRoom.localParticipant.setMicrophoneEnabled(!microphoneEnabled);
    setState((current) => ({
      ...current,
      status: microphoneEnabled ? 'muted' : 'listening',
    }));
  }, []);
  const stopAria = useCallback(async () => {
    const activeRoom = room.current;
    const generationId = generation.current;
    if (activeRoom === null || generationId === null) return;
    setRemoteVolume(activeRoom, 0);
    await publishClientEvent(activeRoom, { kind: 'STOP', generationId });
  }, []);
  const chooseDevice = useCallback(async (deviceId: string) => {
    const activeRoom = room.current;
    if (activeRoom === null) return;
    await activeRoom.switchActiveDevice('audioinput', deviceId, true);
    setState((current) => ({ ...current, activeDeviceId: deviceId }));
  }, []);
  const toggleCaptions = useCallback(() => {
    setState((current) => ({ ...current, captions: !current.captions }));
  }, []);
  return { enable, mute, stopAria, chooseDevice, toggleCaptions };
}

/**
 * Turn the microphone and the speaker on, in the order a browser requires.
 *
 * `startAudio()` first: it is the call that has to happen inside a user gesture, and until it
 * resolves nothing this page does can make a sound. Everything after it — the microphone, the
 * acknowledgement, the sync, the VAD — is bookkeeping that only matters once there is audio.
 *
 * Extracted from the hook rather than written inside the callback because it is a sequence
 * with a failure path, not a one-liner, and a hook should read as a list of what it returns.
 */
async function enableVoice(refs: VoiceActionRefs): Promise<void> {
  const { room, generation, enabled, acknowledgedSeq, vad, setState, timings } = refs;
  const activeRoom = room.current;
  if (activeRoom === null) return;
  try {
    await activeRoom.startAudio();
    await activeRoom.localParticipant.setMicrophoneEnabled(true, {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    });
    enabled.current = true;
    // X-04: the browser has just permitted sound. That closes `audio_unlocked` and opens the
    // §11 audible-welcome bar, which runs from here to the first sample out of the speaker.
    timings?.stop('audio_unlocked');
    timings?.start('audible_welcome');
    await publishAcknowledgement(activeRoom, acknowledgedSeq.current);
    await publishClientEvent(activeRoom, { kind: 'SYNC' });
    vad.current()?.();
    vad.set(
      startVad(activeRoom, setState, () => {
        onLocalSpeech(activeRoom, generation, timings);
      }),
    );
    setState((current) => ({ ...current, status: 'listening' }));
  } catch {
    enabled.current = false;
    timings?.cancel('audible_welcome');
    setState((current) => ({ ...current, status: 'unavailable' }));
  }
}

/**
 * The child started talking. Only an interruption when Aria is mid-generation.
 *
 * X-04: that case is exactly what the §11 interrupt bar measures, so the clock starts here and
 * is stopped where the client next observes her go quiet (`voice-timings.ts`). The visible stop
 * button is deliberately not measured: it silences the room locally and instantly, so folding
 * it in would dilute the bar with a path that cannot miss it.
 */
function onLocalSpeech(
  room: Room,
  generation: VoiceActionRefs['generation'],
  timings: TurnTimingReporter | undefined,
): void {
  if (generation.current === null) return;
  timings?.start('interrupt_silence');
  void publishClientEvent(room, { kind: 'SPEECH_STARTED' });
}
