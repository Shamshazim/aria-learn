import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Times-table slips: adding the factors, or one group too few or too many. */
export const MUL_FACT_10_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-mul-fact-10-added',
    skillCode: 'MUL.FACT.10',
    name: 'Adds the two numbers',
    signature: 'Answers with the sum of the factors instead of the product',
    remediation: 'Times means groups. Seven groups of six is six, seven times over.',
    approach: 'visual-model',
    model: 'an array of seven rows with six dots in each',
    detects: { kind: 'derived', rule: 'added-instead' },
  },
  {
    id: 'misconception-mul-fact-10-one-group-short',
    skillCode: 'MUL.FACT.10',
    name: 'Counts one group too few',
    signature: 'Skip-counts one jump short, landing on the product of one fewer group',
    remediation: 'Touch a row each time you count. Stop when every row has been counted.',
    approach: 'visual-model',
    model: 'an array with each row ticked as it is counted',
    detects: { kind: 'derived', rule: 'one-group-short' },
  },
  {
    id: 'misconception-mul-fact-10-one-group-extra',
    skillCode: 'MUL.FACT.10',
    name: 'Counts one group too many',
    signature: 'Skip-counts one jump past the product',
    remediation: 'Count the jumps, not the numbers you say. Seven jumps of six.',
    approach: 'visual-model',
    model: 'a number line with seven jumps of six marked',
    detects: { kind: 'derived', rule: 'one-group-extra' },
  },
];
