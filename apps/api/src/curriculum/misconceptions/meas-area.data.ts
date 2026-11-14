import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Area and perimeter go wrong by being mixed up, or by using only two sides. */
export const MEAS_AREA_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-meas-area-swapped',
    skillCode: 'MEAS.AREA',
    name: 'Mixes up area and perimeter',
    signature: 'Gives the perimeter when asked for area, or the area when asked for perimeter',
    remediation: 'Area is how many squares fit inside. The edge is the walk all the way round.',
    approach: 'visual-model',
    model: 'a rectangle drawn as squares with its edge traced',
    detects: { kind: 'derived', rule: 'swapped-measure' },
  },
  {
    id: 'misconception-meas-area-added-two-sides',
    skillCode: 'MEAS.AREA',
    name: 'Adds just two sides',
    signature: 'Adds the length and the width once each',
    remediation: 'A rectangle has four sides. Walk all the way round, or count all the rows.',
    approach: 'visual-model',
    model: 'a rectangle with all four sides labelled',
    detects: { kind: 'derived', rule: 'added-two-sides' },
  },
  {
    id: 'misconception-meas-area-one-side-squared',
    skillCode: 'MEAS.AREA',
    name: 'Multiplies one side by itself',
    signature: 'Uses one side twice instead of the length and the width',
    remediation: 'It is not a square. Use the length and the width, one of each.',
    approach: 'visual-model',
    model: 'a rectangle drawn as rows and columns of squares',
    detects: { kind: 'derived', rule: 'one-side-squared' },
  },
];
