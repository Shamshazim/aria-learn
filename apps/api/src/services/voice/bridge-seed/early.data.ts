import type { BridgeBucket } from '@aria/voice';

/**
 * What Aria says to a five- to seven-year-old while she thinks (P2H-09).
 *
 * Short, warm, and never a judgement: a child this age hears "okay!" as approval, so nothing
 * here may sound like a verdict on the answer. Every line is under a second when spoken.
 */
export const EARLY_BRIDGE_SEED: Readonly<Partial<Record<BridgeBucket, readonly string[]>>> = {
  acknowledge: [
    'Okay!',
    'Mm-hmm.',
    'Ooh.',
    'Okay, let me look.',
    'Got it.',
    'Alright.',
    'Mmm, okay.',
    'Let me see.',
  ],
  thinking: [
    'Hmm.',
    'Let me think.',
    'Ooh, good one.',
    'Hmm, let me see.',
    'Thinking.',
    'Just a sec.',
    'Hmm, tricky.',
    'Let me have a think.',
  ],
  encourage: [
    "That's okay.",
    "That's okay, we can look together.",
    'We can figure it out.',
    'All good.',
    "Let's look at it together.",
    "That's a tricky one.",
    "I've got you.",
    "Let's take another look.",
  ],
  transition: [
    'Okay, here we go.',
    'Alright, next one.',
    'Okay, ready?',
    "Here's something else.",
    "Let's try this.",
    'Okay, coming up.',
    "Here's the next bit.",
    'Alright, this way.',
  ],
  'confirm-heard': [
    'Hmm, say that again?',
    'Sorry, one more time?',
    'I missed that.',
    'Say it once more?',
    "I didn't catch that.",
    'One more time for me?',
    'Hmm, what was that?',
    'Tell me again?',
  ],
};
