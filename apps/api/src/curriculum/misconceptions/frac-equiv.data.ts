import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Equivalence goes wrong by adding instead of scaling, or by scaling only half the fraction. */
export const FRAC_EQUIV_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-frac-equiv-additive',
    skillCode: 'FRAC.EQUIV',
    name: 'Adds the same to the top and the bottom',
    signature: 'Adds to the numerator whatever was added to the denominator',
    remediation:
      'Cut every piece into the same number of smaller pieces. The top grows the same way.',
    approach: 'visual-model',
    model: 'a fraction bar with each piece cut into four smaller ones',
    detects: { kind: 'derived', rule: 'additive-equivalence' },
  },
  {
    id: 'misconception-frac-equiv-kept-numerator',
    skillCode: 'FRAC.EQUIV',
    name: 'Keeps the top number the same',
    signature: 'Changes the denominator and leaves the numerator as it was',
    remediation: 'Smaller pieces means more of them. Count the shaded pieces again after cutting.',
    approach: 'visual-model',
    model: 'two bars of the same length, one cut into thirds and one into twelfths',
    detects: { kind: 'derived', rule: 'kept-numerator' },
  },
  {
    id: 'misconception-frac-equiv-answered-factor',
    skillCode: 'FRAC.EQUIV',
    name: 'Answers with the number the bottom was multiplied by',
    signature: 'Finds how many times bigger the new denominator is and stops there',
    remediation: 'You found the bottom was times four. Now do the same to the top.',
    approach: 'worked-example',
    model: 'the multiplying written beside both the top and the bottom',
    detects: { kind: 'derived', rule: 'answered-the-factor' },
  },
];
