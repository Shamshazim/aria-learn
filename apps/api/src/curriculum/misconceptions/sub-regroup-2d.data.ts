import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Every one of these is the ones column on top being smaller than the one below. */
export const SUB_REGROUP_2D_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-sub-regroup-smaller-from-larger',
    skillCode: 'SUB.REGROUP.2D',
    name: 'Takes the smaller digit from the bigger',
    signature: 'In each column subtracts the smaller digit from the larger, whichever is on top',
    remediation: 'The top number is what you have. If the ones are too few, break a ten.',
    approach: 'visual-model',
    model: 'place-value blocks with one ten rod traded for ten ones',
    detects: { kind: 'derived', rule: 'smaller-from-larger' },
  },
  {
    id: 'misconception-sub-regroup-tens-not-reduced',
    skillCode: 'SUB.REGROUP.2D',
    name: 'Borrows a ten but keeps it in the tens',
    signature: 'Adds ten to the ones column but never takes one from the tens',
    remediation: 'The ten you broke has gone from the tens. Cross one ten off before you subtract.',
    approach: 'visual-model',
    model: 'a ten rod moved out of the tens column and broken into ones',
    detects: { kind: 'derived', rule: 'borrowed-without-reducing-tens' },
  },
  {
    id: 'misconception-sub-regroup-zero-when-smaller',
    skillCode: 'SUB.REGROUP.2D',
    name: 'Writes zero when the top digit is smaller',
    signature: 'Decides the ones cannot be taken away and writes a zero in that column',
    remediation: 'You can take it away, after a trade. Break one ten into ten ones first.',
    approach: 'visual-model',
    model: 'a ten rod traded for ten ones in the ones column',
    detects: { kind: 'derived', rule: 'zero-when-smaller' },
  },
];
