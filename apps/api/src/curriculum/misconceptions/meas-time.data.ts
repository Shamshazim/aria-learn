import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** A clock counts minutes to sixty, not to a hundred. */
export const MEAS_TIME_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-meas-time-minutes-as-hundreds',
    skillCode: 'MEAS.TIME',
    name: 'Counts the minutes past sixty',
    signature: 'Adds the minutes as if an hour had a hundred of them, writing 2:75',
    remediation: 'An hour has 60 minutes. At 60 the clock goes round to the next hour.',
    approach: 'visual-model',
    model: 'a clock face with the minute hand going past twelve',
    detects: { kind: 'derived', rule: 'minutes-as-hundreds' },
  },
  {
    id: 'misconception-meas-time-hour-not-carried',
    skillCode: 'MEAS.TIME',
    name: 'Forgets to move the hour on',
    signature: 'Takes the minutes past sixty but leaves the hour the same',
    remediation: 'The minute hand went past twelve, so the hour hand moved on one.',
    approach: 'visual-model',
    model: 'a clock face with both hands moving',
    detects: { kind: 'derived', rule: 'hour-not-carried' },
  },
  {
    id: 'misconception-meas-time-minutes-replaced',
    skillCode: 'MEAS.TIME',
    name: 'Puts the added minutes in place of the time',
    signature: 'Writes the number of minutes added as the new minutes',
    remediation: 'Start at the time it is now and count on the minutes from there.',
    approach: 'visual-model',
    model: 'a number line of the clock from the start time',
    detects: { kind: 'derived', rule: 'minutes-replaced' },
  },
];
