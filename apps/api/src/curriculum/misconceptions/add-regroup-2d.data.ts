import type { AuthoredMisconception } from '@/curriculum/misconceptions/signature.types';

/** Every one of these is the carried ten going somewhere it should not. */
export const ADD_REGROUP_2D_MISCONCEPTIONS: readonly AuthoredMisconception[] = [
  {
    id: 'misconception-add-regroup-no-carry',
    skillCode: 'ADD.REGROUP.2D',
    name: 'Does not carry a regrouped ten',
    signature: 'Adds each place independently and leaves a two-digit ones total',
    remediation: 'Build the ones. Trade ten ones for one ten. Then add the tens.',
    approach: 'visual-model',
    model: 'place-value blocks, trading ten ones for one ten rod',
    detects: { kind: 'derived', rule: 'place-independent-sum' },
  },
  {
    id: 'misconception-add-regroup-dropped-carry',
    skillCode: 'ADD.REGROUP.2D',
    name: 'Drops the carried ten',
    signature: 'Writes the ones digit correctly but never adds the ten into the tens column',
    remediation: 'The traded ten is a whole rod. Put it with the other tens before you count them.',
    approach: 'visual-model',
    model: 'the traded ten rod put down with the other tens',
    detects: { kind: 'derived', rule: 'dropped-carry' },
  },
  {
    id: 'misconception-add-regroup-carried-ones-digit',
    skillCode: 'ADD.REGROUP.2D',
    name: 'Carries the wrong digit of the ones total',
    signature: 'Writes the tens digit of the ones total and carries its ones digit',
    remediation: 'Fifteen is one ten and five ones. Five stays down; the one ten moves across.',
    approach: 'visual-model',
    model: 'fifteen ones built as one ten rod and five ones',
    detects: { kind: 'derived', rule: 'carried-ones-digit' },
  },
];
