import type { Misconception } from '@aria/shared';

/** Known wrong ideas that require reteaching rather than another generic hint. */
export const MISCONCEPTIONS = [
  {
    id: 'misconception-add-regroup-no-carry',
    skillCode: 'ADD.REGROUP.2D',
    name: 'Does not carry a regrouped ten',
    signature: 'Adds each place independently and leaves a two-digit ones total',
    remediation: 'Build the ones with blocks, trade ten ones for one ten, then add the tens.',
  },
  {
    id: 'misconception-frac-compare-denominator',
    skillCode: 'FRAC.COMPARE',
    name: 'Bigger denominator means a bigger fraction',
    signature: 'Chooses 1/8 as greater than 1/3 because 8 is greater than 3',
    remediation: 'Cut equal wholes into thirds and eighths, then compare one piece from each.',
  },
  {
    id: 'misconception-ph-silent-e-short-vowel',
    skillCode: 'PH.SILENT_E',
    name: 'Reads the vowel as short before silent e',
    signature: 'Reads a silent-e word as its CVC form, such as cape as cap',
    remediation: 'Contrast the CVC word and silent-e word, then mark how e changes the vowel.',
  },
] as const satisfies readonly Misconception[];
