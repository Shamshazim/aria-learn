import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Decoding fails when the child reads names, guesses early, or mis-hears the vowel. */
export const PH_CVC_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-ph-cvc-letter-names',
    skillCode: 'PH.CVC',
    name: 'Reads the letter names instead of their sounds',
    signature: 'Answers with letter names such as see ay tee',
    remediation: 'That is what the letter is called. What sound does it make?',
    detects: {
      kind: 'pattern',
      pattern:
        '\\b(?:ay|bee|see|dee|ee|ef|gee|aitch|jay|kay|el|em|en|oh|pee|cue|ar|ess|tee|vee|ex|wy|zed)\\b',
    },
  },
  {
    id: 'misconception-ph-cvc-first-letter-guess',
    skillCode: 'PH.CVC',
    name: 'Guesses the word from its first letter',
    signature: 'Offers a word that starts correctly but was not read through',
    remediation: 'Good start. Now read every letter before you say the word.',
    detects: { kind: 'shares-key-prefix', length: 1 },
  },
  {
    id: 'misconception-ph-cvc-vowel-swap',
    skillCode: 'PH.CVC',
    name: 'Reads the middle vowel as a different vowel',
    signature: 'Answers with the same word shape but the wrong vowel sound',
    remediation: 'Cover the ends and read just the middle letter. Now put it back.',
    detects: { kind: 'derived', rule: 'swapped-vowel' },
  },
];
