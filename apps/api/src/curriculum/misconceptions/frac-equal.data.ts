import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Equality goes wrong when the child reads the numerals instead of the pieces. */
export const FRAC_EQUAL_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-frac-equal-different-numerals',
    skillCode: 'FRAC.EQUAL',
    name: 'Different numerals must mean different amounts',
    signature: 'Calls equivalent fractions unequal because they are written differently',
    remediation:
      'Lay one strip on the other. Same length is the same amount, however it is written.',
    approach: 'visual-model',
    model: 'two fraction bars of the same length, laid one on the other',
    detects: { kind: 'derived', rule: 'says-unequal-for-equivalent' },
  },
  {
    id: 'misconception-frac-equal-same-numerator',
    skillCode: 'FRAC.EQUAL',
    name: 'Same top number means the same amount',
    signature: 'Calls two fractions equal because their numerators match',
    remediation: 'One piece of three is not one piece of four. Look at the size of a piece first.',
    approach: 'visual-model',
    model: 'one piece of three beside one piece of four',
    detects: { kind: 'derived', rule: 'says-equal-for-same-numerator' },
  },
  {
    id: 'misconception-frac-equal-same-denominator',
    skillCode: 'FRAC.EQUAL',
    name: 'Same bottom number means the same amount',
    signature: 'Calls two fractions equal because their denominators match',
    remediation: 'The pieces match, so count them. Two pieces is not three pieces.',
    approach: 'visual-model',
    model: 'one bar cut into quarters, two pieces shaded then three',
    detects: { kind: 'derived', rule: 'says-equal-for-same-denominator' },
  },
];
