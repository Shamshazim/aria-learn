import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Percent of goes wrong when "per hundred" is forgotten, or "of" is read as another sign. */
export const PCT_OF_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-pct-of-no-hundred',
    skillCode: 'PCT.OF',
    name: 'Forgets that percent means out of a hundred',
    signature: 'Multiplies the percent by the whole and never divides by a hundred',
    remediation: 'Percent means out of a hundred. 25% is 25 out of 100, which is one quarter.',
    approach: 'visual-model',
    model: 'a hundred-square with 25 squares shaded',
    detects: { kind: 'derived', rule: 'percent-without-hundred' },
  },
  {
    id: 'misconception-pct-of-divided',
    skillCode: 'PCT.OF',
    name: 'Divides by the percent',
    signature: 'Reads "of" as "divided by" and divides the whole by the percent',
    remediation: 'Of means times here. A quarter of 80 is 80 shared into four, then one share.',
    approach: 'concrete-story',
    model: '80 counters shared into four equal groups',
    detects: { kind: 'derived', rule: 'divided-by-percent' },
  },
  {
    id: 'misconception-pct-of-subtracted',
    skillCode: 'PCT.OF',
    name: 'Takes the percent away from the whole',
    signature: 'Subtracts the percent from the whole number',
    remediation: 'The answer is a part of 80, so it is smaller than 80. Find the part first.',
    approach: 'visual-model',
    model: 'a bar of 80 split into four equal parts with one shaded',
    detects: { kind: 'derived', rule: 'subtracted-percent' },
  },
];
