import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Absolute value is a distance; each of these forgets that a distance is never negative. */
export const INT_ABS_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-int-abs-kept-sign',
    skillCode: 'INT.ABS',
    name: 'Keeps the minus sign',
    signature: 'Gives the negative number back unchanged',
    remediation: 'Absolute value is how far from zero. A distance is never below zero.',
    approach: 'visual-model',
    model: 'a number line with the steps from zero counted',
    detects: { kind: 'derived', rule: 'kept-sign' },
  },
  {
    id: 'misconception-int-abs-negated',
    skillCode: 'INT.ABS',
    name: 'Thinks absolute value means the opposite',
    signature: 'Turns a positive number negative',
    remediation: '7 is seven steps from zero already. Its absolute value is 7.',
    approach: 'visual-model',
    model: 'a number line with seven steps from zero to 7',
    detects: { kind: 'derived', rule: 'negated' },
  },
  {
    id: 'misconception-int-abs-counted-zero',
    skillCode: 'INT.ABS',
    name: 'Counts zero as a step',
    signature: 'Counts the marks from zero including zero itself, one too many',
    remediation: 'Count the jumps, not the marks. Start at zero and say one on the first jump.',
    approach: 'visual-model',
    model: 'jumps drawn as arcs from zero along a number line',
    detects: { kind: 'derived', rule: 'counted-zero' },
  },
];
