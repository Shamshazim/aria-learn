import { type Room, Track } from 'livekit-client';

import type { VoiceState } from './voice-state';

export function startVad(
  room: Room,
  setState: React.Dispatch<React.SetStateAction<VoiceState>>,
  onSpeechStarted: () => void,
): () => void {
  const publication = room.localParticipant.getTrackPublication(Track.Source.Microphone);
  const media = publication?.track?.mediaStreamTrack;
  if (media === undefined) return () => undefined;
  const context = new AudioContext();
  const analyser = context.createAnalyser();
  context.createMediaStreamSource(new MediaStream([media])).connect(analyser);
  const samples = new Uint8Array(analyser.fftSize);
  let frame = 0;
  let restore = 0;
  let speaking = false;
  const tick = (): void => {
    analyser.getByteTimeDomainData(samples);
    const level = rms(samples);
    setState((current) => ({ ...current, microphoneLevel: level }));
    if (level > 0.08) {
      if (!speaking) onSpeechStarted();
      speaking = true;
      setRemoteVolume(room, 0.125);
      window.clearTimeout(restore);
      restore = window.setTimeout(() => {
        setRemoteVolume(room, 1);
      }, 1_500);
    } else if (level < 0.04) {
      speaking = false;
    }
    frame = window.requestAnimationFrame(tick);
  };
  tick();
  return () => {
    window.cancelAnimationFrame(frame);
    window.clearTimeout(restore);
    void context.close();
  };
}

export function setRemoteVolume(room: Room, volume: number): void {
  for (const participant of room.remoteParticipants.values()) participant.setVolume(volume);
}

function rms(samples: Uint8Array): number {
  const sum = samples.reduce((total, sample) => total + ((sample - 128) / 128) ** 2, 0);
  return Math.sqrt(sum / samples.length);
}
