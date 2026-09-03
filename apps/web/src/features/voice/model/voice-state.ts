export type VoiceStatus =
  'connecting' | 'ready' | 'listening' | 'muted' | 'recovering' | 'needs-consent' | 'unavailable';

export type VoiceState = Readonly<{
  status: VoiceStatus;
  microphoneLevel: number;
  captions: boolean;
  devices: readonly MediaDeviceInfo[];
  activeDeviceId: string;
  /** What Aria is saying, in her words ("Aria talks"), or the move's line on the pipeline. */
  caption: string;
  /** What she heard the child say, so the screen shows the microphone is working. */
  heard: string;
  /** True where a realtime model is Aria's voice, so the screen answers through it. */
  talks: boolean;
}>;

export const INITIAL_VOICE_STATE: VoiceState = {
  status: 'connecting',
  microphoneLevel: 0,
  captions: true,
  devices: [],
  activeDeviceId: '',
  caption: '',
  heard: '',
  talks: false,
};

export function withVoiceDevices(
  state: VoiceState,
  devices: readonly MediaDeviceInfo[],
): VoiceState {
  return { ...state, devices };
}
