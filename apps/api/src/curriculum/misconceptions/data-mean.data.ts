import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Averages go wrong by skipping the sorting, the sharing, or the right average. */
export const DATA_MEAN_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-data-mean-median-unsorted',
    skillCode: 'DATA.MEAN',
    name: 'Takes the middle before sorting',
    signature: 'Gives the middle number of the list as it was written',
    remediation: 'Put the numbers in order first. Then find the middle one.',
    approach: 'worked-example',
    model: 'the numbers rewritten smallest to biggest',
    detects: { kind: 'derived', rule: 'median-unsorted' },
  },
  {
    id: 'misconception-data-mean-swapped',
    skillCode: 'DATA.MEAN',
    name: 'Mixes up the mean and the median',
    signature: 'Gives the median when asked for the mean, or the mean for the median',
    remediation: 'The mean is share it out evenly. The median is the middle one in order.',
    approach: 'concrete-story',
    model: 'sweets shared evenly between friends',
    detects: { kind: 'derived', rule: 'swapped-measure' },
  },
  {
    id: 'misconception-data-mean-sum-not-divided',
    skillCode: 'DATA.MEAN',
    name: 'Adds them up and stops',
    signature: 'Gives the total instead of sharing it by how many numbers there are',
    remediation: 'Now share the total out. Divide by how many numbers there are.',
    approach: 'concrete-story',
    model: 'a pile of sweets shared into equal piles',
    detects: { kind: 'derived', rule: 'sum-not-divided' },
  },
];
