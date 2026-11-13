import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** A whole times a fraction is that many copies of the fraction; each of these loses that. */
export const FRAC_MUL_WHOLE_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-frac-mul-whole-multiplied-both',
    skillCode: 'FRAC.MUL.WHOLE',
    name: 'Multiplies the top and the bottom',
    signature: 'Multiplies both numerator and denominator by the whole number',
    remediation: 'Three lots of two fifths is still fifths. Only the count of fifths grows.',
    approach: 'visual-model',
    model: 'three copies of a two-fifths bar laid side by side',
    detects: { kind: 'derived', rule: 'multiplied-both' },
  },
  {
    id: 'misconception-frac-mul-whole-added-whole',
    skillCode: 'FRAC.MUL.WHOLE',
    name: 'Puts the whole number next to the fraction',
    signature: 'Writes the whole number and the fraction together, as if adding them',
    remediation: 'Times means groups. Three groups of two fifths, not three and two fifths.',
    approach: 'concrete-story',
    model: 'three plates with two fifths of a cake on each',
    detects: { kind: 'derived', rule: 'added-whole' },
  },
  {
    id: 'misconception-frac-mul-whole-multiplied-denominator',
    skillCode: 'FRAC.MUL.WHOLE',
    name: 'Multiplies only the bottom',
    signature: 'Multiplies the denominator by the whole number, making the pieces smaller',
    remediation: 'More groups means more pieces, not smaller pieces. Count the fifths.',
    approach: 'visual-model',
    model: 'copies of a fraction bar counted piece by piece',
    detects: { kind: 'derived', rule: 'multiplied-denominator' },
  },
];
