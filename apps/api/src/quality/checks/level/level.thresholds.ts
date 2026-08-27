import type { Band } from '@aria/shared';

/**
 * Per-band readability ceilings (P2H-02). Sentence length is a hard cap; the syllable metrics
 * describe how the text reads on average, so one long word does not sink a warm sentence.
 *
 * The Flesch–Kincaid ceilings sit one grade above the band's top grade on purpose: FK reads
 * natural spoken explanation a grade high, and a tutor who has to stay a grade *below* the
 * child is a tutor who cannot use the word "equivalent" in a lesson about equivalence.
 *
 * Tune against `__fixtures__/level-corpus.fixture.ts` and the P0-21 golden set; every change
 * here is a change to what a child hears, so record it in the PR that makes it.
 */
export type LevelThresholds = Readonly<{
  maxWordsPerSentence: number;
  maxMeanSyllablesPerWord: number;
  maxLongWordsPerHundred: number;
  /** Flesch–Kincaid grade ceiling; `null` skips the score (too noisy on very short text). */
  maxFleschKincaidGrade: number | null;
}>;

export const LEVEL_THRESHOLDS: Readonly<Record<Band, LevelThresholds>> = {
  early: {
    maxWordsPerSentence: 12,
    maxMeanSyllablesPerWord: 1.45,
    maxLongWordsPerHundred: 12,
    maxFleschKincaidGrade: null,
  },
  middle: {
    maxWordsPerSentence: 20,
    maxMeanSyllablesPerWord: 1.6,
    maxLongWordsPerHundred: 12,
    maxFleschKincaidGrade: 7,
  },
  senior: {
    maxWordsPerSentence: 30,
    maxMeanSyllablesPerWord: 1.8,
    maxLongWordsPerHundred: 20,
    maxFleschKincaidGrade: 10,
  },
};

/** Words exempt from syllable counting: Aria's own name and everyday interjections. */
export const EXEMPT_WORDS: ReadonlySet<string> = new Set([
  'aria',
  'okay',
  'ok',
  'hmm',
  'oh',
  'wow',
  'yay',
  'yes',
  'nice',
  'uh',
  'huh',
]);
