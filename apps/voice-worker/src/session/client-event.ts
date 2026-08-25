import { voiceClientEventSchema, type VoiceClientEvent } from '@aria/shared';

const decoder = new TextDecoder();

export function parseClientEvent(payload: Uint8Array): VoiceClientEvent | null {
  try {
    const parsed = voiceClientEventSchema.safeParse(JSON.parse(decoder.decode(payload)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
