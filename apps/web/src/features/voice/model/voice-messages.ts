import {
  tutorMoveSchema,
  voiceWorkerStateSchema,
  type TutorMove,
  type VoiceWorkerState,
} from '@aria/shared';

const decoder = new TextDecoder();

export function parseVoiceMove(payload: Uint8Array): TutorMove | null {
  try {
    const parsed = tutorMoveSchema.safeParse(JSON.parse(decoder.decode(payload)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function parseVoiceWorkerState(payload: Uint8Array): VoiceWorkerState | null {
  try {
    const state = voiceWorkerStateSchema.safeParse(JSON.parse(decoder.decode(payload)));
    return state.success ? state.data : null;
  } catch {
    return null;
  }
}
