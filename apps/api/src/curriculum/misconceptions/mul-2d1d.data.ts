import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Every one of these is the tens from the ones product going somewhere it should not. */
export const MUL_2D1D_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-mul-2d1d-products-side-by-side',
    skillCode: 'MUL.2D1D',
    name: 'Writes each product down whole',
    signature: 'Multiplies each digit and writes both products side by side',
    remediation: 'One digit per column. The tens from the ones product move left.',
    approach: 'worked-example',
    model: 'a column multiplication with the carried tens written above',
    detects: { kind: 'derived', rule: 'column-products-concatenated' },
  },
  {
    id: 'misconception-mul-2d1d-dropped-carry',
    skillCode: 'MUL.2D1D',
    name: 'Drops the carried tens',
    signature: 'Writes the ones digit of the ones product and never adds its tens on',
    remediation: 'Forty-two ones is four tens and two ones. Add those four tens to the tens.',
    approach: 'visual-model',
    model: 'forty-two ones traded for four ten rods and two ones',
    detects: { kind: 'derived', rule: 'dropped-product-carry' },
  },
  {
    id: 'misconception-mul-2d1d-tens-as-ones',
    skillCode: 'MUL.2D1D',
    name: 'Treats the tens digit as ones',
    signature: 'Multiplies the tens digit as if it were ones and adds the two products',
    remediation: 'The 4 in 47 is four tens. Six times four tens is twenty-four tens.',
    approach: 'visual-model',
    model: 'six groups of four ten rods',
    detects: { kind: 'derived', rule: 'tens-digit-as-ones' },
  },
];
