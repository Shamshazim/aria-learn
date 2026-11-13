import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Division facts go wrong by doing the wrong operation, or by stopping a group early. */
export const DIV_FACT_10_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-div-fact-10-multiplied',
    skillCode: 'DIV.FACT.10',
    name: 'Multiplies instead of dividing',
    signature: 'Answers with the product of the two numbers',
    remediation:
      'Divide means share out. Share the counters into equal groups and count one group.',
    approach: 'concrete-story',
    model: 'counters shared one at a time into equal piles',
    detects: { kind: 'derived', rule: 'multiplied-instead' },
  },
  {
    id: 'misconception-div-fact-10-subtracted',
    skillCode: 'DIV.FACT.10',
    name: 'Takes the numbers away',
    signature: 'Answers with the difference between the two numbers',
    remediation: 'Ask how many groups fit. Use the times table you know, backwards.',
    approach: 'visual-model',
    model: 'an array split into equal rows',
    detects: { kind: 'derived', rule: 'subtracted-instead' },
  },
  {
    id: 'misconception-div-fact-10-one-group-short',
    skillCode: 'DIV.FACT.10',
    name: 'Counts one group too few',
    signature: 'Skip-counts towards the whole and stops one group early',
    remediation: 'Keep counting in jumps until you land right on the number. Then count the jumps.',
    approach: 'visual-model',
    model: 'a number line with equal jumps up to the whole',
    detects: { kind: 'derived', rule: 'one-group-short' },
  },
];
