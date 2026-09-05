import { describe, expect, it } from 'vitest';

import { MOVE_KINDS, type MoveKind } from '@aria/shared';
import { PLANNER_APPROACHES } from '@aria/tutor';

import {
  APPROACH_INSTRUCTIONS,
  instructionFor,
  MOVE_INSTRUCTIONS,
} from '@/ai/prompts/persona/move-prompt.map';

type Choice = readonly [MoveKind, string];

const CHOICES: readonly Choice[] = MOVE_KINDS.flatMap((move) =>
  PLANNER_APPROACHES[move].map((approach): Choice => [move, approach]),
);

/**
 * P2H-06: the planner picks an approach and P2H-03 has to say something different because of
 * it. Two lists in two packages have to agree for that to be true, and nothing but this test
 * makes them.
 */
describe('planner approaches and persona instructions', () => {
  it.each(CHOICES.filter(([, approach]) => approach !== 'default'))(
    '%s:%s changes what the move says',
    (move, approach) => {
      expect(APPROACH_INSTRUCTIONS[`${move}:${approach}`]).toBeDefined();
    },
  );

  it.each(CHOICES.filter(([, approach]) => approach === 'default'))(
    '%s:%s falls back to the move instruction on purpose',
    (move, approach) => {
      expect(instructionFor(move, approach)).toBe(MOVE_INSTRUCTIONS[move]);
    },
  );

  it('writes no instruction for an approach nobody can choose', () => {
    const choosable = new Set([
      ...CHOICES.map(([move, approach]) => `${move}:${approach}`),
      // The policy's own approaches. They never pass through `PLANNER_APPROACHES`, because
      // reviewed text does not need the planner's permission.
      'SAY:reask-short',
      'SAY:check-in',
      'SAY:deflect-personal-info',
      'RETEACH:misconception-fix',
      'RETEACH:visual-model',
      'RETEACH:worked-example',
      'PRAISE:specific-evidence',
      'REVEAL:worked-example',
      'REVEAL:move-on',
      'SWITCH:prerequisite-step',
      'SWITCH:next-topic',
      'HINT:single-nudge',
    ]);

    expect(Object.keys(APPROACH_INSTRUCTIONS).filter((key) => !choosable.has(key))).toEqual([]);
  });
});
