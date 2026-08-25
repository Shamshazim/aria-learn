import type { Misconception } from '@aria/shared';

/** Known wrong ideas that require reteaching rather than another generic hint. */
export const MISCONCEPTIONS = [
  {
    id: 'misconception-add-regroup-no-carry',
    skillCode: 'ADD.REGROUP.2D',
    name: 'Does not carry a regrouped ten',
    signature: 'Adds each place independently and leaves a two-digit ones total',
    remediation: 'Build the ones. Trade ten ones for one ten. Then add the tens.',
  },
  {
    id: 'misconception-frac-compare-denominator',
    skillCode: 'FRAC.COMPARE',
    name: 'Bigger denominator means a bigger fraction',
    signature: 'Chooses 1/8 as greater than 1/3 because 8 is greater than 3',
    remediation:
      'Use the same whole. Cut one into thirds and one into eighths. Then look at one piece.',
  },
  {
    id: 'misconception-ph-silent-e-short-vowel',
    skillCode: 'PH.SILENT_E',
    name: 'Reads the vowel as short before silent e',
    signature: 'Reads a silent-e word as its CVC form, such as cape as cap',
    remediation: 'Read the short word. Then add e and read the new word.',
  },
] as const satisfies readonly Misconception[];
