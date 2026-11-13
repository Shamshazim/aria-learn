import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Facts that cross ten go wrong at the ten: stopping there, or counting the start twice. */
export const ADD_FACT_20_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-add-fact-20-stopped-at-ten',
    skillCode: 'ADD.FACT.20',
    name: 'Makes the ten and stops',
    signature: 'Fills the ten and answers ten, forgetting the ones left over',
    remediation: 'Fill the ten-frame first. Then put the leftover counters next to it. Count both.',
    approach: 'visual-model',
    model: 'a full ten-frame with the leftover counters beside it',
    detects: { kind: 'derived', rule: 'stopped-at-ten' },
  },
  {
    id: 'misconception-add-fact-20-off-by-one-short',
    skillCode: 'ADD.FACT.20',
    name: 'Lands one short when counting on',
    signature: 'Counts the starting number as the first step, so the total is one less',
    remediation: 'Say the big number. Then count on, one jump for each of the others.',
    approach: 'visual-model',
    model: 'a number line started on the larger number, one jump per counter',
    detects: { kind: 'off-by', delta: -1 },
  },
  {
    id: 'misconception-add-fact-20-subtracted',
    skillCode: 'ADD.FACT.20',
    name: 'Takes away instead of adding',
    signature: 'Answers with the difference between the two numbers',
    remediation: 'Add means the pile gets bigger. Push both groups together and count them all.',
    approach: 'concrete-story',
    model: 'two groups of counters pushed together into one pile',
    detects: { kind: 'derived', rule: 'subtracted-instead' },
  },
];
