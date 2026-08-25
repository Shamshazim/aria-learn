/**
 * Deterministic English syllable estimate (P2H-02).
 *
 * Vowel-group counting with the common silent-e, `-es`/`-ed` and leading-y corrections, plus an
 * exceptions table for frequent words the heuristic gets wrong. Exact counts are not the goal;
 * a stable band score is.
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
};

export function countSyllables(rawWord: string): number {
  const word = rawWord.toLowerCase().replace(/[^a-z]/gu, '');
  if (word === '') return 0;
  const known = EXCEPTIONS[word];
  if (known !== undefined) return known;
  if (word.length <= 3) return 1;
  const trimmed = word
    .replace(/(?:[^laeiouy]es|[^laeiouytd]ed|[^laeiouy]e)$/u, '')
    .replace(/^y/u, '');
  const groups = trimmed.match(/[aeiouy]{1,2}/gu);
  return Math.max(1, groups?.length ?? 1);
}
