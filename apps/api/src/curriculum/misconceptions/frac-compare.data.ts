import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Comparison is where the bottom number gets read as a size instead of a count. */
export const FRAC_COMPARE_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-frac-compare-denominator',
    skillCode: 'FRAC.COMPARE',
    name: 'Bigger denominator means a bigger fraction',
    signature: 'Chooses 1/8 as greater than 1/3 because 8 is greater than 3',
    remediation:
      'Use the same whole. Cut one into thirds and one into eighths. Then look at one piece.',
    approach: 'visual-model',
    model: 'one whole cut into thirds beside the same whole cut into eighths',
    detects: { kind: 'derived', rule: 'larger-denominator-wins' },
  },
  {
    id: 'misconception-frac-compare-same-numerator',
    skillCode: 'FRAC.COMPARE',
    name: 'Same top number means equal',
    signature: 'Answers equal because the numerators match, ignoring the piece size',
    remediation: 'Same number of pieces, different pieces. Put the two bars side by side.',
    approach: 'visual-model',
    model: 'two bars cut the same way, shaded lengths side by side',
    detects: { kind: 'derived', rule: 'says-equal-for-same-numerator' },
  },
  {
    id: 'misconception-frac-compare-reversed',
    skillCode: 'FRAC.COMPARE',
    name: 'Reverses greater and less',
    signature: 'Names the correct pair but the opposite relation',
    remediation: 'Point at the longer shaded bar and say which one that is. That one is greater.',
    approach: 'visual-model',
    model: 'the two shaded bars, pointing at the longer one',
    detects: { kind: 'derived', rule: 'reversed-comparison' },
  },
];
