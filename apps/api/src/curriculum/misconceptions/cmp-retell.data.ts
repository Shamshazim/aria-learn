import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** A retell fails on order, or by giving the question back. */
export const CMP_RETELL_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-cmp-retell-no-sequence',
    skillCode: 'CMP.RETELL',
    name: 'Retells without any order',
    signature: 'The retell contains no ordering words at all',
    remediation: 'What happened first? And then? Tell me the parts in order.',
    detects: { kind: 'pattern', pattern: '^(?!.*\\b(?:first|then|next|after|last|finally)\\b).*$' },
  },
  {
    id: 'misconception-cmp-retell-ending-first',
    skillCode: 'CMP.RETELL',
    name: 'Starts the retell at the ending',
    signature: 'Opens with the last event rather than the first',
    remediation: 'That is how it ended. Take me back to the start.',
    detects: { kind: 'pattern', pattern: '^(?:last|at the end|in the end|finally)\\b' },
  },
  {
    id: 'misconception-cmp-retell-echoes-question',
    skillCode: 'CMP.RETELL',
    name: 'Gives the question back as the retell',
    signature: 'Repeats the question instead of recounting the story',
    remediation: 'That is what I asked. Now you tell me what happened.',
    detects: { kind: 'derived', rule: 'echoes-the-question' },
  },
];
