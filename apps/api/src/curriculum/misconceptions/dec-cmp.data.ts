import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Every one of these is the length of a decimal mistaken for its size. */
export const DEC_CMP_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-dec-cmp-longer-is-larger',
    skillCode: 'DEC.CMP',
    name: 'Thinks more digits means bigger',
    signature: 'Picks the decimal with more digits after the point, as with whole numbers',
    remediation: 'Write both with two places. 0.3 is 0.30. Now 30 hundredths beats 25.',
    approach: 'visual-model',
    model: 'two hundred-squares, one with 30 shaded and one with 25',
    detects: { kind: 'derived', rule: 'longer-is-larger' },
  },
  {
    id: 'misconception-dec-cmp-shorter-is-larger',
    skillCode: 'DEC.CMP',
    name: 'Thinks fewer digits means bigger',
    signature: 'Picks the decimal with fewer digits, because tenths are bigger than hundredths',
    remediation: 'Tenths are bigger pieces, but count them. 0.4 is 0.40, and 0.75 is more.',
    approach: 'visual-model',
    model: 'a number line from 0 to 1 with both decimals marked',
    detects: { kind: 'derived', rule: 'shorter-is-larger' },
  },
  {
    id: 'misconception-dec-cmp-reversed',
    skillCode: 'DEC.CMP',
    name: 'Writes the sign the wrong way round',
    signature: 'Knows which is bigger but points the sign at the bigger number',
    remediation: 'The open side faces the bigger number. Read it left to right out loud.',
    approach: 'concrete-story',
    model: 'the sign drawn as a mouth eating the bigger number',
    detects: { kind: 'derived', rule: 'reversed-comparison' },
  },
];
