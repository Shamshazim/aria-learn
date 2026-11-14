import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Change goes wrong in the cents, or in where the point goes. */
export const MEAS_MONEY_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-meas-money-smaller-from-larger',
    skillCode: 'MEAS.MONEY',
    name: 'Takes the smaller digit from the bigger',
    signature: 'In each column takes the smaller digit from the bigger, so no dollar is broken',
    remediation: 'There are no cents in $5.00 to take from. Break a dollar into 100 cents first.',
    approach: 'visual-model',
    model: 'a dollar note swapped for coins',
    detects: { kind: 'derived', rule: 'smaller-from-larger' },
  },
  {
    id: 'misconception-meas-money-added',
    skillCode: 'MEAS.MONEY',
    name: 'Adds instead of taking away',
    signature: 'Adds the price to the money paid',
    remediation: 'Change is what comes back, so it is less than you paid. Count up from the price.',
    approach: 'concrete-story',
    model: 'counting up from the price to the money paid, as a shop does',
    detects: { kind: 'derived', rule: 'added-instead' },
  },
  {
    id: 'misconception-meas-money-dropped-point',
    skillCode: 'MEAS.MONEY',
    name: 'Leaves out the decimal point',
    signature: 'Gets the digits right but writes the change without the point',
    remediation: '155 dollars is a lot of change. Write the point: $1.55.',
    approach: 'worked-example',
    model: 'the point written between dollars and cents',
    detects: { kind: 'derived', rule: 'dropped-decimal-point' },
  },
];
