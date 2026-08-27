/**
 * Deterministic English syllable estimate (P2H-02).
 *
 * Vowel-group counting with three corrections that are systematic rather than word-specific:
 * a silent final `e`, the `-es`/`-ed` inflections that do not add a beat, and the
 * consonant + `le` ending that does. Everything left over is genuinely irregular English and
 * lives in the exceptions table.
 *
 * Exact counts are not the goal; a stable band score is. `syllables.test.ts` holds the
 * estimator to ≥ 97% exact agreement with the reviewed corpus.
 */
const EXCEPTIONS: Readonly<Record<string, number>> = {
  the: 1,
  are: 1,
  were: 1,
  every: 3,
  everything: 3,
  different: 3,
  favorite: 3,
  favourite: 3,
  idea: 3,
  area: 3,
  really: 2,
  people: 2,
  little: 2,
  middle: 2,
  simple: 2,
  circle: 2,
  table: 2,
  able: 2,
  apple: 2,
  purple: 2,
  fire: 2,
  hour: 1,
  our: 1,
  chocolate: 3,
  once: 1,
  something: 2,
  // Irregular: a silent `e` in the middle of a compound or before a suffix, and vowel pairs
  // that the two-letter group rule merges but English reads as two beats.
  sometimes: 2,
  measurement: 3,
  maybe: 2,
  triangle: 3,
  punctuation: 4,
  quantity: 3,
  science: 2,
};

const SILENT_ES = /(?:[sxz]|ch|sh)es$/u;
const SPOKEN_ED = /[td]ed$/u;
const CONSONANT_LE = /[^aeiou]le$/u;

export function countSyllables(rawWord: string): number {
  const word = rawWord.toLowerCase().replace(/[^a-z]/gu, '');
  if (word === '') return 0;
  const known = EXCEPTIONS[word];
  if (known !== undefined) return known;
  if (word.length <= 3) return 1;
  const groups = stripSilentEndings(word)
    .replace(/^y/u, '')
    .match(/[aeiouy]{1,2}/gu);
  return Math.max(1, groups?.length ?? 1);
}

/**
 * Reduces an inflected form to its base and then removes a silent final `e`.
 *
 * `-es` and `-ed` are folded back to a bare `e` first so "hopes" and "hoped" go through the
 * same silent-e rule as "hope"; the two exceptions ("wishes", "wanted") keep their beat.
 */
function stripSilentEndings(word: string): string {
  const base = uninflect(word);
  if (!base.endsWith('e') || base.endsWith('ee')) return base;
  // "table" and "little" say the `le`; "whole" and "smile" do not, because the letter before
  // the `l` is already a vowel carrying the sound.
  return CONSONANT_LE.test(base) ? base : base.slice(0, -1);
}

function uninflect(word: string): string {
  if (word.endsWith('es') && !SILENT_ES.test(word)) return `${word.slice(0, -2)}e`;
  if (word.endsWith('ed') && !SPOKEN_ED.test(word)) return `${word.slice(0, -2)}e`;
  return word;
}
