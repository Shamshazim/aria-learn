import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Rhyme is heard at the end of a word; every miss here is listening somewhere else. */
export const PA_RHYME_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-pa-rhyme-initial-sound',
    skillCode: 'PA.RHYME',
    name: 'Matches the first sound instead of the last',
    signature: 'Offers a word that starts like the prompt rather than ending like it',
    remediation: 'Rhyme lives at the end. Say both words and hold the last part.',
    approach: 'concrete-story',
    model: 'both words said aloud with the ending held long',
    detects: { kind: 'shares-question-prefix', length: 1 },
  },
  {
    id: 'misconception-pa-rhyme-semantic-match',
    skillCode: 'PA.RHYME',
    name: 'Matches by meaning rather than by sound',
    signature: 'Offers a word from the same topic, such as dog for cat',
    remediation: 'We are using our ears. Which word ends like cat?',
    approach: 'simpler-case',
    model: 'a two-word choice where only one ends like the prompt',
    detects: { kind: 'exact', answers: ['dog', 'kitten', 'puppy', 'pet', 'mouse', 'bird'] },
  },
  {
    id: 'misconception-pa-rhyme-echoes-prompt',
    skillCode: 'PA.RHYME',
    name: 'Says the prompt word back',
    signature: 'Repeats the question instead of offering a rhyming word',
    remediation:
      'That is the word we started with. Now give me a different word that ends the same.',
    approach: 'simpler-case',
    model: 'a short rhyme chain the child adds one word to',
    detects: { kind: 'derived', rule: 'echoes-the-question' },
  },
];
