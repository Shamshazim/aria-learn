import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Writing one word fails by copying, by leaving out the vowel, or by writing letters that are not a word. */
export const WR_WORD_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-wr-word-no-vowel',
    skillCode: 'WR.WORD',
    name: 'Writes a word with no vowel in it',
    signature: 'The written word contains only consonants',
    remediation: 'Say it slowly. Which sound is in the middle? That one needs a letter too.',
    detects: { kind: 'pattern', pattern: '^[bcdfghjklmnpqrstvwxyz]+$' },
  },
  {
    id: 'misconception-wr-word-copies-prompt',
    skillCode: 'WR.WORD',
    name: 'Copies the prompt instead of choosing a word',
    signature: 'Writes the question back rather than a word for the idea',
    remediation: 'That is my question. What is your word for it?',
    detects: { kind: 'derived', rule: 'echoes-the-question' },
  },
  {
    id: 'misconception-wr-word-letter-run',
    skillCode: 'WR.WORD',
    name: 'Writes a run of repeated letters',
    signature: 'The written word repeats one letter three or more times',
    remediation: 'One letter for each sound you hear. Say the word slowly and count them.',
    detects: { kind: 'pattern', pattern: '(.)\\1{2,}' },
  },
];
