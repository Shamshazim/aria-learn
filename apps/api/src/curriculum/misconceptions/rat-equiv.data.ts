import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Equivalent ratios go wrong by adding where they should scale. */
export const RAT_EQUIV_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-rat-equiv-additive',
    skillCode: 'RAT.EQUIV',
    name: 'Adds the same to both terms',
    signature: 'Adds to the second term whatever was added to the first',
    remediation: '2 became 8 by times four, not by adding. Do times four to the 3 as well.',
    approach: 'visual-model',
    model: 'a double number line with both rows counted in equal jumps',
    detects: { kind: 'derived', rule: 'additive-ratio' },
  },
  {
    id: 'misconception-rat-equiv-kept-second',
    skillCode: 'RAT.EQUIV',
    name: 'Leaves the second term as it was',
    signature: 'Changes the first term and keeps the second the same',
    remediation:
      'Both parts of a ratio grow together. If one is four times bigger, so is the other.',
    approach: 'concrete-story',
    model: 'a recipe doubled, with every amount doubled',
    detects: { kind: 'derived', rule: 'kept-second-term' },
  },
  {
    id: 'misconception-rat-equiv-answered-scale',
    skillCode: 'RAT.EQUIV',
    name: 'Answers with how many times bigger',
    signature: 'Finds the scale factor and gives that as the answer',
    remediation: 'You found times four. Now use it: 3 times 4.',
    approach: 'worked-example',
    model: 'the times four written beside both terms',
    detects: { kind: 'derived', rule: 'answered-the-scale' },
  },
];
