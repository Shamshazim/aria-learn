import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** A unit rate is a division; each of these does something else with the two numbers. */
export const RAT_UNIT_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-rat-unit-multiplied',
    skillCode: 'RAT.UNIT',
    name: 'Multiplies the two numbers',
    signature: 'Multiplies the amount by the number of units instead of sharing it',
    remediation: 'One hour is less than four hours, so the answer is smaller. Share it out.',
    approach: 'concrete-story',
    model: 'a journey split into four equal hours',
    detects: { kind: 'derived', rule: 'multiplied-instead' },
  },
  {
    id: 'misconception-rat-unit-subtracted',
    skillCode: 'RAT.UNIT',
    name: 'Takes one number from the other',
    signature: 'Subtracts the number of units from the amount',
    remediation: 'Share the amount into equal parts, one for each hour. How much is one part?',
    approach: 'visual-model',
    model: 'a bar of 48 split into four equal parts',
    detects: { kind: 'derived', rule: 'subtracted-instead' },
  },
  {
    id: 'misconception-rat-unit-additive',
    skillCode: 'RAT.UNIT',
    name: 'Takes off one for each hour fewer',
    signature: 'Goes down by one unit of time and takes the same number off the amount',
    remediation: 'Each hour is a whole share, not one. Find the share by dividing.',
    approach: 'visual-model',
    model: 'a double number line from 0 to 4 hours and 0 to 48 km',
    detects: { kind: 'derived', rule: 'additive-ratio' },
  },
];
