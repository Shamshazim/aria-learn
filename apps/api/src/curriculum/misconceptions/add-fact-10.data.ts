import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Facts within ten go wrong by one, or by answering with something already on the page. */
export const ADD_FACT_10_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-add-fact-10-off-by-one-short',
    skillCode: 'ADD.FACT.10',
    name: 'Lands one short of the answer',
    signature: 'Counts the starting number as the first step, so the total is one less',
    remediation: 'Start on the bigger number and count on. Do not count it again.',
    detects: { kind: 'off-by', delta: -1 },
  },
  {
    id: 'misconception-add-fact-10-names-an-operand',
    skillCode: 'ADD.FACT.10',
    name: 'Answers with one of the numbers being added',
    signature: 'Repeats an operand instead of combining the two',
    remediation:
      'Both numbers go in. Fill the ten-frame with the first, then keep adding the second.',
    detects: { kind: 'derived', rule: 'names-an-operand' },
  },
  {
    id: 'misconception-add-fact-10-subtracted',
    skillCode: 'ADD.FACT.10',
    name: 'Takes away instead of adding',
    signature: 'Answers with the difference between the two numbers',
    remediation: 'Add means the pile gets bigger. Put both groups together and count them all.',
    detects: { kind: 'derived', rule: 'subtracted-instead' },
  },
];
