import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Converting goes wrong in the direction, or in how many to a unit. */
export const MEAS_CONV_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-meas-conv-divided',
    skillCode: 'MEAS.CONV',
    name: 'Divides when going to a smaller unit',
    signature: 'Divides by the number in the table instead of multiplying',
    remediation: 'Smaller units means more of them. 3 m is lots of cm, not a tiny bit.',
    approach: 'concrete-story',
    model: 'a metre stick with its centimetres marked',
    detects: { kind: 'derived', rule: 'divided-instead' },
  },
  {
    id: 'misconception-meas-conv-used-ten',
    skillCode: 'MEAS.CONV',
    name: 'Uses ten for every change of unit',
    signature: 'Multiplies by ten whatever the units are',
    remediation: 'Each pair of units has its own number. 1 m is 100 cm.',
    approach: 'worked-example',
    model: 'a table of units and how many make the next',
    detects: { kind: 'derived', rule: 'used-ten' },
  },
  {
    id: 'misconception-meas-conv-wrong-factor',
    skillCode: 'MEAS.CONV',
    name: 'Uses the wrong number of small units',
    signature: 'Uses 100 where it should be 1000, or counts an hour as 100 minutes',
    remediation: 'Check the table. 1 km is 1000 m, and 1 hour is 60 minutes.',
    approach: 'worked-example',
    model: 'a table of units and how many make the next',
    detects: { kind: 'derived', rule: 'wrong-factor' },
  },
];
