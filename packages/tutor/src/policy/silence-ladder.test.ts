import { describe, expect, it } from 'vitest';

import { silenceRung } from './silence-ladder';

describe('silence ladder', () => {
  it('changes approach on every rung and always ends', () => {
    const kinds = [1, 2, 3, 4, 5].map((count) => silenceRung(count));
    expect(kinds.map((rung) => rung.kind)).toEqual(['SAY', 'HINT', 'SAY', 'BREAK', 'BREAK']);
    expect(kinds.map((rung) => rung.approach)).toEqual([
      'reask-short',
      'single-nudge',
      'check-in',
      'attention',
      'attention',
    ]);
    expect(kinds.map((rung) => rung.terminal)).toEqual([false, false, false, true, true]);
  });

  it('never proposes LISTEN for silence', () => {
    for (let count = 0; count < 10; count += 1) expect(silenceRung(count).kind).not.toBe('LISTEN');
  });
});
