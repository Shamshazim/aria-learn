import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Comparing two-digit numbers goes wrong by flipping the sign, or by looking at the wrong digit. */
export const NUM_CMP_100_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-num-cmp-100-reversed',
    skillCode: 'NUM.CMP.100',
    name: 'Points the sign the wrong way',
    signature: 'Knows which number is bigger but writes < for greater than, or > for less than',
    remediation:
      'The open side of the sign faces the bigger number. Draw the sign as a mouth eating the bigger one.',
    approach: 'concrete-story',
    model: 'the sign drawn as an open mouth turned towards the larger number',
    detects: { kind: 'derived', rule: 'reversed-comparison' },
  },
  {
    id: 'misconception-num-cmp-100-ones-first',
    skillCode: 'NUM.CMP.100',
    name: 'Compares the ones digits',
    signature: 'Says 29 is more than 31 because 9 is more than 1',
    remediation: 'Look at the tens first. Three tens is more than two tens. The ones come next.',
    approach: 'visual-model',
    model: 'both numbers built from tens rods and ones, the rods lined up side by side',
    detects: { kind: 'derived', rule: 'ones-digit-comparison' },
  },
  {
    id: 'misconception-num-cmp-100-same-tens',
    skillCode: 'NUM.CMP.100',
    name: 'Calls two numbers equal when their tens match',
    signature: 'Says 42 and 47 are the same because both have four tens',
    remediation: 'Same tens means look at the ones next. Equal means every digit matches.',
    approach: 'simpler-case',
    model: 'two numbers on a number line between 40 and 50, one dot for each',
    detects: { kind: 'derived', rule: 'same-tens-equal' },
  },
];
