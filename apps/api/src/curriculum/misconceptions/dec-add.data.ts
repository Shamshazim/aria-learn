import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Adding decimals goes wrong where the points are not lined up, or not kept. */
export const DEC_ADD_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-dec-add-right-aligned',
    skillCode: 'DEC.ADD',
    name: 'Lines up the digits on the right',
    signature: 'Lines up the last digits as with whole numbers, not the decimal points',
    remediation: 'Line up the points, not the ends. Give 3.4 a zero: 3.40.',
    approach: 'worked-example',
    model: 'the two numbers written one above the other with the points in a column',
    detects: { kind: 'derived', rule: 'right-aligned-digits' },
  },
  {
    id: 'misconception-dec-add-dropped-point',
    skillCode: 'DEC.ADD',
    name: 'Leaves out the decimal point',
    signature: 'Works the columns correctly but writes the answer with no decimal point',
    remediation: 'The point comes straight down into the answer. About how big should it be?',
    approach: 'worked-example',
    model: 'the point drawn straight down from the numbers into the answer',
    detects: { kind: 'derived', rule: 'dropped-decimal-point' },
  },
  {
    id: 'misconception-dec-add-parts-as-wholes',
    skillCode: 'DEC.ADD',
    name: 'Adds the parts after the point as whole numbers',
    signature: 'Adds the whole parts, then adds the digits after each point as if they were wholes',
    remediation:
      'Four tenths and twenty-five hundredths are not 29 of anything. Make them both hundredths.',
    approach: 'visual-model',
    model: 'a hundred-square with forty and twenty-five shaded',
    detects: { kind: 'derived', rule: 'decimal-parts-as-wholes' },
  },
];
