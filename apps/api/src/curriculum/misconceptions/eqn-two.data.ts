import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Two steps go wrong by stopping after one, undoing them in the wrong order, or wrong way round. */
export const EQN_TWO_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-eqn-two-stopped',
    skillCode: 'EQN.TWO',
    name: 'Stops after one step',
    signature: 'Takes the added number away and gives that as x, without dividing',
    remediation: 'That is what 3x is. One more step: divide by 3 to find one x.',
    approach: 'worked-example',
    model: 'the two steps listed, with the second still to do',
    detects: { kind: 'derived', rule: 'stopped-after-one-step' },
  },
  {
    id: 'misconception-eqn-two-divided-first',
    skillCode: 'EQN.TWO',
    name: 'Divides before taking away',
    signature: 'Divides the right side first, then takes the constant away',
    remediation: 'Undo in reverse. The + 4 was done last, so undo it first.',
    approach: 'concrete-story',
    model: 'putting on socks then shoes, and taking them off shoes first',
    detects: { kind: 'derived', rule: 'divided-first' },
  },
  {
    id: 'misconception-eqn-two-wrong-inverse',
    skillCode: 'EQN.TWO',
    name: 'Undoes with the same operations',
    signature: 'Adds where it should take away and multiplies where it should divide',
    remediation: 'Each undo is the opposite. Take away the 4, then divide by 3.',
    approach: 'visual-model',
    model: 'a balance with the same done to both pans at each step',
    detects: { kind: 'derived', rule: 'wrong-inverse' },
  },
];
