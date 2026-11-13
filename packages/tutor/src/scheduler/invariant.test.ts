import { describe, expect, it } from 'vitest';

import { forbiddenAfterStuck, neverStuckTwice } from './invariant';

describe('the stuck-twice invariant', () => {
  it('allows anything before two wrong answers', () => {
    expect(forbiddenAfterStuck({ wrongOnSkill: 1, stuckOnItem: 1 })).toEqual([]);
  });

  it('forbids asking again, and a second hint on the same item', () => {
    expect(forbiddenAfterStuck({ wrongOnSkill: 2, stuckOnItem: 0 })).toEqual(['ASK']);
    expect(forbiddenAfterStuck({ wrongOnSkill: 2, stuckOnItem: 1 })).toEqual(['ASK', 'HINT']);
    expect(neverStuckTwice({ wrongOnSkill: 2, stuckOnItem: 1, kind: 'HINT' })?.kind).toBe(
      'RETEACH',
    );
  });

  it('P3-07: lets a hint at a new step of a written method through, and still forbids asking', () => {
    const input = { wrongOnSkill: 3, stuckOnItem: 2, newProcedureStep: true };
    expect(forbiddenAfterStuck(input)).toEqual(['ASK']);
    expect(neverStuckTwice({ ...input, kind: 'HINT' })).toBeNull();
    expect(neverStuckTwice({ ...input, kind: 'ASK' })?.kind).toBe('RETEACH');
  });
});
