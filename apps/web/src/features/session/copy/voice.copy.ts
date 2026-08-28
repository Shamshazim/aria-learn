import type { Band } from '@aria/shared';

import type { VoiceAvailability } from '@/features/session/model/voice-availability';

/**
 * Why "Talk to Aria" is greyed out, in the child's own register.
 *
 * `ready` has no sentence: a reason next to a button that works reads as a warning.
 */
export const VOICE_REASON_COPY: Readonly<
  Record<Exclude<VoiceAvailability, 'ready'>, Readonly<Record<Band, string>>>
> = {
  connecting: {
    early: 'Aria is getting her ears ready…',
    middle: 'Voice is starting…',
    senior: 'Voice is starting…',
  },
  'needs-consent': {
    early: 'Talking is off. A grown-up can turn it on.',
    middle: 'Voice is off — a parent can turn it on.',
    senior: 'Voice is off — a parent can turn it on in the family settings.',
  },
  unavailable: {
    early: 'Talking is taking a break. You can tap instead.',
    middle: 'Voice is taking a break. Typing and tapping still work.',
    senior: 'Voice is unavailable right now. Typing and tapping still work.',
  },
  off: {
    early: 'Talking is not on today. You can tap instead.',
    middle: 'Voice is not on for this session. Typing and tapping still work.',
    senior: 'Voice is not on for this session. Typing and tapping still work.',
  },
};
