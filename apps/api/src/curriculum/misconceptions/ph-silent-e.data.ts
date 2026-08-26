import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** The silent e is either ignored, spoken, or applied where there is none. */
export const PH_SILENT_E_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-ph-silent-e-short-vowel',
    skillCode: 'PH.SILENT_E',
    name: 'Reads the vowel as short before silent e',
    signature: 'Reads a silent-e word as its CVC form, such as cape as cap',
    remediation: 'Read the short word. Then add e and read the new word.',
    detects: { kind: 'key-without-suffix', suffix: 'e' },
  },
  {
    id: 'misconception-ph-silent-e-spoken',
    skillCode: 'PH.SILENT_E',
    name: 'Sounds the final e out loud',
    signature: 'Adds a syllable to the end of the word',
    remediation: 'The e is quiet. It only tells the vowel to say its name.',
    detects: { kind: 'pattern', pattern: '(?:ee|uh|eh)$' },
  },
  {
    id: 'misconception-ph-silent-e-overapplied',
    skillCode: 'PH.SILENT_E',
    name: 'Adds a silent e where the word has none',
    signature: 'Reads a CVC word with a long vowel as though an e were there',
    remediation: 'Look at the end. No e, so the vowel keeps its short sound.',
    detects: { kind: 'key-with-suffix', suffix: 'e' },
  },
];
