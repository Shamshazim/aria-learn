import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Blending breaks in one of three places: the gap, the middle sound, or the guess. */
export const PA_BLEND_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-pa-blend-says-the-sounds',
    skillCode: 'PA.BLEND',
    name: 'Repeats the sounds instead of blending them',
    signature: 'Answers with separated single sounds rather than one word',
    remediation: 'Say them faster, then with no gap at all. Now it is a word.',
    detects: { kind: 'pattern', pattern: '^[a-z](?: [a-z])+$' },
  },
  {
    id: 'misconception-pa-blend-drops-the-middle',
    skillCode: 'PA.BLEND',
    name: 'Loses the middle sound',
    signature: 'Answers with the first and last sounds only',
    remediation: 'Three sounds go in, three come out. Say the middle one on its own first.',
    detects: { kind: 'derived', rule: 'drops-middle-letter' },
  },
  {
    id: 'misconception-pa-blend-first-sound-guess',
    skillCode: 'PA.BLEND',
    name: 'Guesses from the first sound',
    signature: 'Offers a word that starts correctly but is not the one blended',
    remediation: 'You have the first sound. Now wait for all three before you decide.',
    detects: { kind: 'shares-key-prefix', length: 1 },
  },
];
