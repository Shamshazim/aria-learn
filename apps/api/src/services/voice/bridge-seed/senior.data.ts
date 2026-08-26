import type { BridgeBucket } from '@aria/voice';

/**
 * Twelve- to fourteen-year-olds (P2H-09).
 *
 * Rule 6 only ever plays the `thinking` bucket to this band, because everything else reads as
 * filler to them. The other four are written anyway: a band's library is synthesised whole, and
 * the day the rule changes the clips must already exist rather than being written in a hurry.
 */
export const SENIOR_BRIDGE_SEED: Readonly<Record<BridgeBucket, readonly string[]>> = {
  acknowledge: [
    'Okay.',
    'Okay then.',
    'Got it.',
    'Mm-hmm.',
    'One sec.',
    'Let me check.',
    'Hang on.',
    'Sure.',
  ],
  thinking: [
    'Hmm.',
    'Let me think.',
    'Good question.',
    'Give me a second.',
    'Let me work that through.',
    'Hmm, one moment.',
    'Worth thinking about.',
    'Let me get that straight.',
  ],
  encourage: [
    'Fair enough.',
    "That's a common sticking point.",
    "Let's work it through.",
    'Reasonable place to stall.',
    "Let's take it apart.",
    'We can get there.',
    "Let's back up a step.",
    'Worth slowing down on.',
  ],
  transition: [
    'Okay, moving on.',
    'Okay, next.',
    "Let's switch.",
    'Different angle.',
    "Here's the next one.",
    'Onwards.',
    "Let's look at something else.",
    'Okay, over here.',
  ],
  'confirm-heard': [
    'Sorry, say that again?',
    "Didn't catch that.",
    'One more time?',
    'Come again?',
    'That came through fuzzy.',
    'Repeat that for me?',
    'I lost the end of that.',
    'Say that once more?',
  ],
};
