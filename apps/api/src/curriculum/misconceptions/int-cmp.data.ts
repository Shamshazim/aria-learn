import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Ordering negatives goes wrong when the size is read and the sign is not. */
export const INT_CMP_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-int-cmp-size-not-sign',
    skillCode: 'INT.CMP',
    name: 'Compares the sizes and ignores the signs',
    signature: 'Says -7 is more than -3 because 7 is more than 3',
    remediation: 'On the number line, further right is bigger. -3 is to the right of -7.',
    approach: 'visual-model',
    model: 'a number line from -10 to 10 with both numbers marked',
    detects: { kind: 'derived', rule: 'absolute-value-comparison' },
  },
  {
    id: 'misconception-int-cmp-reversed',
    skillCode: 'INT.CMP',
    name: 'Writes the sign the wrong way round',
    signature: 'Knows which is bigger but points the sign at the bigger number',
    remediation: 'The open side faces the bigger number. Read it out loud, left to right.',
    approach: 'concrete-story',
    model: 'the sign drawn as a mouth eating the bigger number',
    detects: { kind: 'derived', rule: 'reversed-comparison' },
  },
  {
    id: 'misconception-int-cmp-zero-smallest',
    skillCode: 'INT.CMP',
    name: 'Thinks zero is the smallest number',
    signature: 'Says zero is less than a negative number',
    remediation: 'Below zero is less than nothing, like owing money. -3 is to the left of 0.',
    approach: 'concrete-story',
    model: 'a thermometer showing temperatures below zero',
    detects: { kind: 'derived', rule: 'zero-is-smallest' },
  },
];
