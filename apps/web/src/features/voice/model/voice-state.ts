export type VoiceStatus =
  'connecting' | 'ready' | 'listening' | 'muted' | 'recovering' | 'needs-consent' | 'unavailable';

export type VoiceState = Readonly<{
  status: VoiceStatus;
  microphoneLevel: number;
  captions: boolean;
  devices: readonly MediaDeviceInfo[];
  activeDeviceId: string;
  caption: string;
}>;

export const INITIAL_VOICE_STATE: VoiceState = {
  status: 'connecting',
  microphoneLevel: 0,
  captions: true,
  devices: [],
  activeDeviceId: '',
  caption: '',
};
