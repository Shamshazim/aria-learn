import type { VoiceStatus } from '@/features/voice/model/voice-state';

/**
 * Whether "Talk to Aria" can do anything right now, and if not, why.
 *
 * The voice hook has seven statuses because the transport has seven states; the child needs
 * five answers: go ahead, wait, a parent has to turn it on, it broke, or it is not here at
 * all. Deriving this once keeps the input surface from knowing anything about LiveKit.
 */
export type VoiceAvailability = 'ready' | 'connecting' | 'needs-consent' | 'unavailable' | 'off';

export function voiceAvailability(
  status: VoiceStatus | null,
  input: Readonly<{ scripted: boolean }>,
): VoiceAvailability {
  // A scripted session speaks through scripted transcripts, so talking always works there.
  if (input.scripted) return 'ready';
  if (status === null) return 'off';
  switch (status) {
    case 'connecting':
    case 'recovering':
      return 'connecting';
    case 'needs-consent':
      return 'needs-consent';
    case 'unavailable':
      return 'unavailable';
    case 'ready':
    case 'listening':
    case 'muted':
      return 'ready';
    default:
      return assertNever(status);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled voice status: ${String(value)}`);
}
