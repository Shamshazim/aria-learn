import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Dividing fractions goes wrong at the flip: skipping it, or flipping the wrong one. */
export const FRAC_DIV_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-frac-div-multiplied',
    skillCode: 'FRAC.DIV',
    name: 'Multiplies without flipping',
    signature: 'Multiplies the fractions straight across',
    remediation:
      'How many eighths fit in three quarters? More than one. Flip the second, then multiply.',
    approach: 'visual-model',
    model: 'a bar of three quarters measured out in eighths',
    detects: { kind: 'derived', rule: 'multiplied-instead' },
  },
  {
    id: 'misconception-frac-div-flipped-first',
    skillCode: 'FRAC.DIV',
    name: 'Flips the first fraction',
    signature: 'Turns the first fraction over instead of the second',
    remediation: 'Keep the first. Flip the one you are dividing by.',
    approach: 'worked-example',
    model: 'keep, change, flip written under the two fractions',
    detects: { kind: 'derived', rule: 'flipped-dividend' },
  },
  {
    id: 'misconception-frac-div-flipped-both',
    skillCode: 'FRAC.DIV',
    name: 'Flips both fractions',
    signature: 'Turns both fractions over before multiplying',
    remediation: 'Only one flip. The first fraction stays just as it is.',
    approach: 'worked-example',
    model: 'the first fraction circled to show it stays',
    detects: { kind: 'derived', rule: 'flipped-both' },
  },
];
