import { describe, expect, it } from 'vitest';

import { applyPronunciation, NO_PRONUNCIATION_HINTS } from './names';

describe('pronunciation', () => {
  it('respells a curriculum word the engine reads wrongly', () => {
    expect(applyPronunciation('The numerator is on top.', NO_PRONUNCIATION_HINTS)).toBe(
      'The NEW-mer-ay-tor is on top.',
    );
  });

  it("lets a parent's spelling win over the shared lexicon", () => {
    expect(applyPronunciation('Hi Numerator!', { Numerator: 'noo-MAIR' })).toBe('Hi noo-MAIR!');
  });

  it('says a name the way the profile spells it, whatever the case', () => {
    expect(applyPronunciation('Good work, siobhan.', { Siobhan: 'shiv-AWN' })).toBe(
      'Good work, shiv-AWN.',
    );
  });

  it('matches whole words only', () => {
    expect(applyPronunciation('phonemes', { phoneme: 'FOH-neem' })).toBe('phonemes');
  });

  it('treats a spelling as text, not as a replacement pattern', () => {
    expect(applyPronunciation('Hi Al.', { Al: '$& $1' })).toBe('Hi $& $1.');
  });

  it('changes nothing when there is nothing to fix', () => {
    expect(applyPronunciation('Nice work today.', NO_PRONUNCIATION_HINTS)).toBe('Nice work today.');
  });
});
