export type VoiceStatus =
  'connecting' | 'ready' | 'listening' | 'muted' | 'recovering' | 'needs-consent' | 'unavailable';

export type VoiceState = Readonly<{
  status: VoiceStatus;
  microphoneLevel: number;
  captions: boolean;
  devices: readonly MediaDeviceInfo[];
  activeDeviceId: string;
  /** The last sentence Aria said, in her words ("Aria talks"), or the move's line on the pipeline. */
  caption: string;
  /**
   * Everything Aria has said in her current turn, sentence by sentence. It starts again
   * when she starts a new turn, so the screen shows what she is saying now rather than
   * the last sentence of it.
   */
  transcript: string;
  /** What she heard the child say, so the screen shows the microphone is working. */
  heard: string;
  /** True where a realtime model is Aria's voice, so the screen answers through it. */
  talks: boolean;
  /** True while Aria is talking, from the worker; the status line follows this. */
  speaking: boolean;
}>;

export const INITIAL_VOICE_STATE: VoiceState = {
  status: 'connecting',
  microphoneLevel: 0,
  captions: true,
  devices: [],
  activeDeviceId: '',
  caption: '',
  transcript: '',
  heard: '',
  talks: false,
  speaking: false,
};

export function withVoiceDevices(
  state: VoiceState,
  devices: readonly MediaDeviceInfo[],
): VoiceState {
  return { ...state, devices };
}

/** The voice is connected and the child can be heard: the worker owns silence and status. */
export function isVoiceLive(status: VoiceStatus): boolean {
  return status === 'listening' || status === 'muted';
}
