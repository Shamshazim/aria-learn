import type { Band } from '@aria/shared';

/**
 * Per-band readability ceilings (P2H-02). Sentence length is a hard cap; the syllable metrics
 * describe how the text reads on average, so one long word does not sink a warm sentence.
 * Tune against the P0-21 golden set; record changes in the PR that makes them.
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
    maxFleschKincaidGrade: 6,
  },
  senior: {
    maxWordsPerSentence: 30,
    maxMeanSyllablesPerWord: 1.8,
    maxLongWordsPerHundred: 20,
    maxFleschKincaidGrade: 9,
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
