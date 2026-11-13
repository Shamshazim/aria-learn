import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Same-size pieces go wrong when the size of the piece is changed, lost or never added. */
export const FRAC_ADD_LIKE_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-frac-add-like-combined-denominators',
    skillCode: 'FRAC.ADD.LIKE',
    name: 'Adds the bottoms as well as the tops',
    signature: 'Adds the numerators and adds the denominators too',
    remediation: 'The pieces are eighths before and after. Only the number of pieces changes.',
    approach: 'visual-model',
    model: 'one bar cut into eighths, with both groups of pieces shaded on it',
    detects: { kind: 'derived', rule: 'combined-denominators' },
  },
  {
    id: 'misconception-frac-add-like-numerator-only',
    skillCode: 'FRAC.ADD.LIKE',
    name: 'Forgets what size the pieces are',
    signature: 'Gives the count of pieces as a whole number and drops the denominator',
    remediation: 'Five what? Say the size of the piece. Five eighths.',
    approach: 'concrete-story',
    model: 'pizza slices counted out loud as eighths',
    detects: { kind: 'derived', rule: 'numerator-only' },
  },
  {
    id: 'misconception-frac-add-like-flipped',
    skillCode: 'FRAC.ADD.LIKE',
    name: 'Does the other operation',
    signature: 'Takes away when asked to add, or adds when asked to take away',
    remediation: 'Read the sign again. Add puts pieces in. Take away removes them.',
    approach: 'concrete-story',
    model: 'pieces of a bar put on or taken off',
    detects: { kind: 'derived', rule: 'flipped-operation' },
  },
];
