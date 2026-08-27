import { describe, expect, it } from 'vitest';

import { SYLLABLE_FIXTURE } from '@/quality/checks/level/__fixtures__/syllables.fixture';
import { countSyllables } from '@/quality/checks/level/syllables';

const EXACT_BAR = 0.97;

describe('countSyllables', () => {
  it('agrees exactly with the reviewed corpus at or above the bar', () => {
    const misses = SYLLABLE_FIXTURE.filter(
      (entry) => countSyllables(entry.word) !== entry.syllables,
    ).map(
      (entry) =>
        `${entry.word}: expected ${String(entry.syllables)}, got ${String(countSyllables(entry.word))}`,
    );
    const rate = (SYLLABLE_FIXTURE.length - misses.length) / SYLLABLE_FIXTURE.length;

    expect(rate, `misses:\n${misses.join('\n')}`).toBeGreaterThanOrEqual(EXACT_BAR);
  });

  it('never returns zero for a real word and ignores non-letters', () => {
    for (const entry of SYLLABLE_FIXTURE) expect(countSyllables(entry.word)).toBeGreaterThan(0);
    expect(countSyllables('12')).toBe(0);
    expect(countSyllables("don't")).toBe(1);
  });
});
