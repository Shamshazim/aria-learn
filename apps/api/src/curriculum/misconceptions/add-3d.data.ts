import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Three columns means two places a trade can go wrong. */
export const ADD_3D_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-add-3d-column-sums',
    skillCode: 'ADD.3D',
    name: 'Writes each column total down whole',
    signature: 'Adds every column on its own and writes a two-digit total where it does not fit',
    remediation: 'One digit per column. Ten ones become a ten. Ten tens become a hundred.',
    approach: 'visual-model',
    model: 'place-value blocks, trading ten of a kind for one of the next',
    detects: { kind: 'derived', rule: 'column-sums-concatenated' },
  },
  {
    id: 'misconception-add-3d-dropped-every-carry',
    skillCode: 'ADD.3D',
    name: 'Never carries',
    signature: 'Keeps the ones digit of every column total and loses each trade',
    remediation: 'When a column makes ten or more, the extra ten moves left. Write it at the top.',
    approach: 'worked-example',
    model: 'a column sum with each carried one written above the next column',
    detects: { kind: 'derived', rule: 'dropped-every-carry' },
  },
  {
    id: 'misconception-add-3d-dropped-hundreds-carry',
    skillCode: 'ADD.3D',
    name: 'Forgets the carry into the hundreds',
    signature: 'Carries from the ones correctly but loses the trade from the tens to the hundreds',
    remediation:
      'Ten tens make one hundred. Put that hundred with the others before you count them.',
    approach: 'visual-model',
    model: 'ten ten-rods swapped for one hundred flat',
    detects: { kind: 'derived', rule: 'dropped-hundreds-carry' },
  },
];
