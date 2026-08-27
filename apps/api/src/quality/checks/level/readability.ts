import type { Band } from '@aria/shared';

import { EXEMPT_WORDS, LEVEL_THRESHOLDS } from '@/quality/checks/level/level.thresholds';
import { countSyllables } from '@/quality/checks/level/syllables';

export type ReadabilityMetrics = Readonly<{
  words: number;
  sentences: number;
  longestSentenceWords: number;
  meanSyllablesPerWord: number;
  longWordsPerHundred: number;
  fleschKincaidGrade: number;
}>;

export type ReadabilityFailure = Readonly<{ code: string; message: string }>;

const CONTRACTION_SUFFIX = /'(?:s|re|ll|ve|d|m|t)$/u;
const MIN_WORDS_FOR_DENSITY = 8;
/**
 * A ratio needs something to be a ratio of. One three-syllable word in a short sentence is
 * 12.5% of it — "Let's try it together, Sam!" is not academic prose, and rejecting it is how
 * the old whitelist ended up feeding children static text.
 */
const MIN_LONG_WORDS = 2;

export function sentencesOf(text: string): readonly string[] {
  return text.split(/[.!?]+/u).filter((sentence) => sentence.trim() !== '');
}

/** Tokens are letters and apostrophes; digits are ignored so "12" never counts as a word. */
export function wordsOf(text: string): readonly string[] {
  return (text.toLowerCase().match(/[a-z][a-z']*/gu) ?? []).map((word) =>
    word.replace(CONTRACTION_SUFFIX, ''),
  );
}

export function measureReadability(text: string): ReadabilityMetrics {
  const sentences = sentencesOf(text);
  const allWords = wordsOf(text);
  const counted = allWords.filter((word) => !EXEMPT_WORDS.has(word));
  const syllables = counted.map(countSyllables);
  const totalSyllables = syllables.reduce((sum, count) => sum + count, 0);
  const words = counted.length;
  const longWords = syllables.filter((count) => count >= 3).length;
  const sentenceCount = Math.max(1, sentences.length);
  const meanSyllables = words === 0 ? 0 : totalSyllables / words;
  return {
    words,
    sentences: sentenceCount,
    longestSentenceWords: Math.max(0, ...sentences.map((sentence) => wordsOf(sentence).length)),
    meanSyllablesPerWord: meanSyllables,
    longWordsPerHundred: words === 0 ? 0 : (longWords / words) * 100,
    fleschKincaidGrade:
      words === 0 ? 0 : 0.39 * (allWords.length / sentenceCount) + 11.8 * meanSyllables - 15.59,
  };
}

export function readabilityFailures(
  metrics: ReadabilityMetrics,
  band: Band,
): readonly ReadabilityFailure[] {
  const limits = LEVEL_THRESHOLDS[band];
  const failures: ReadabilityFailure[] = [];
  if (metrics.longestSentenceWords > limits.maxWordsPerSentence) {
    failures.push({ code: 'sentence_too_long', message: `Sentence is too long for ${band}.` });
  }
  // Density metrics are noise on a very short line ("Write one paragraph." is one long word
  // out of three); they only apply once there is enough text to describe.
  const enough = metrics.words >= MIN_WORDS_FOR_DENSITY;
  const tooDense = enough && metrics.meanSyllablesPerWord > limits.maxMeanSyllablesPerWord;
  const longWords = Math.round((metrics.longWordsPerHundred / 100) * metrics.words);
  const tooManyLong =
    enough &&
    longWords >= MIN_LONG_WORDS &&
    metrics.longWordsPerHundred > limits.maxLongWordsPerHundred;
  const tooHighGrade =
    enough &&
    limits.maxFleschKincaidGrade !== null &&
    metrics.fleschKincaidGrade > limits.maxFleschKincaidGrade;
  if (tooDense || tooManyLong || tooHighGrade) {
    failures.push({
      code: 'readability',
      message:
        `Text reads above ${band}: mean syllables ${metrics.meanSyllablesPerWord.toFixed(2)}, ` +
        `long words/100 ${metrics.longWordsPerHundred.toFixed(1)}, ` +
        `FK grade ${metrics.fleschKincaidGrade.toFixed(1)}.`,
    });
  }
  return failures;
}
