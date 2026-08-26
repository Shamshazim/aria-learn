import type { BridgeBucket } from '@aria/voice';

/**
 * The same five buckets for eight- to eleven-year-olds (P2H-09).
 *
 * A little longer than the early band and a little drier: this age hears a sing-song "okay!" as
 * talking down. Still nothing that judges the answer.
 */
export const MIDDLE_BRIDGE_SEED: Readonly<Partial<Record<BridgeBucket, readonly string[]>>> = {
  acknowledge: [
    'Okay.',
    'Mm-hmm.',
    'Alright, let me see.',
    'Got it.',
    'Okay, let me check.',
    'Okay, one sec.',
    'Let me have a look.',
    'Okay, hang on.',
  ],
  thinking: [
    'Hmm.',
    'Let me think about that.',
    'Good question.',
    'Hmm, let me think.',
    'Give me a second.',
    'Interesting.',
    'Let me work that out.',
    'Ooh, hang on.',
  ],
  encourage: [
    "That's alright.",
    'This one trips people up.',
    "Let's work through it.",
    'We can unpick that.',
    "Let's take it apart.",
    "That's a fair place to get stuck.",
    'We can sort that out.',
    "Let's back up a step.",
  ],
  transition: [
    'Okay, moving on.',
    'Okay, next.',
    "Let's switch gears.",
    'Okay, different one.',
    "Here's the next thing.",
    'Alright, onwards.',
    "Let's take a look at this instead.",
    'Okay, over here.',
  ],
  'confirm-heard': [
    'Sorry, say that again?',
    "I didn't quite catch that.",
    'One more time?',
    'Come again?',
    'Hmm, repeat that for me?',
    'That came through fuzzy.',
    'Say it once more?',
    'I missed the end of that.',
  ],
};
