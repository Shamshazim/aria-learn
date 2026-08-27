import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** A short piece usually fails at the end, not the beginning. */
export const WR_SHORT_PIECE_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-wr-short-piece-no-ending',
    skillCode: 'WR.SHORT_PIECE',
    name: 'Stops without an ending',
    signature: 'The piece contains no closing signal',
    remediation: 'It stops rather than ends. What is the last thing the reader should know?',
    approach: 'worked-example',
    model: 'the ending sentence written first, then written towards',
    detects: {
      kind: 'pattern',
      pattern: '^(?!.*\\b(?:in the end|finally|at last|by the end|from then on)\\b).*$',
    },
  },
  {
    id: 'misconception-wr-short-piece-dream-ending',
    skillCode: 'WR.SHORT_PIECE',
    name: 'Ends by waking up from it',
    signature: 'Closes with waking up or it being a dream',
    remediation: 'That undoes everything that happened. Let it be real and land it.',
    approach: 'concrete-story',
    model: 'three boxes: what starts it, what happens, how it lands',
    detects: { kind: 'pattern', pattern: '\\b(?:woke up|it was all a dream|just a dream)\\b' },
  },
  {
    id: 'misconception-wr-short-piece-all-setting',
    skillCode: 'WR.SHORT_PIECE',
    name: 'Describes the setting and never gets to the events',
    signature: 'The piece contains no word that moves it along',
    remediation: 'The place is clear. Now what happens in it?',
    approach: 'simpler-case',
    model: 'the middle written on its own, before any setting',
    detects: { kind: 'pattern', pattern: '^(?!.*\\b(?:then|suddenly|next|after that|so)\\b).*$' },
  },
];
