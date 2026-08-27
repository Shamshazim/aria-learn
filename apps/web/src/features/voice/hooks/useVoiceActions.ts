import { type Room, Track } from 'livekit-client';
import { useCallback } from 'react';

import { setRemoteVolume, startVad } from '@/features/voice/model/voice-audio';
import type { VoiceState } from '@/features/voice/model/voice-state';
import { publishAcknowledgement, publishClientEvent } from '@/features/voice/model/voice-transport';

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
}>;

export function useVoiceActions(refs: VoiceActionRefs): VoiceActions {
  const { room, generation, enabled, acknowledgedSeq, vad, setState } = refs;
  const enable = useCallback(async () => {
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
      await publishAcknowledgement(activeRoom, acknowledgedSeq.current);
      await publishClientEvent(activeRoom, { kind: 'SYNC' });
      vad.current()?.();
      vad.set(
        startVad(activeRoom, setState, () => {
          if (generation.current !== null)
            void publishClientEvent(activeRoom, { kind: 'SPEECH_STARTED' });
        }),
      );
      setState((current) => ({ ...current, status: 'listening' }));
    } catch {
      enabled.current = false;
      setState((current) => ({ ...current, status: 'unavailable' }));
    }
  }, []);
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
