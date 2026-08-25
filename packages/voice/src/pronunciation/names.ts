import { CURRICULUM_LEXICON } from './lexicon.data';

/**
 * Saying a child's name right.
 *
 * A name an engine mispronounces is not a rough edge: it is Aria getting the one word that
 * belongs to the child wrong, every session, until someone fixes it. A parent supplies a
 * respelling in the child's profile and it is applied to the speech text only — the screen
 * keeps the name as it is written.
 *
 * The curriculum lexicon rides the same path because it is the same problem with no profile
 * behind it, and it is applied first so a family whose surname happens to be a maths word
 * still gets their own spelling.
 */
export type PronunciationHints = Readonly<Record<string, string>>;

export const NO_PRONUNCIATION_HINTS: PronunciationHints = {};

/** Longest key first, so "greatest common factor" beats "factor" when both are listed. */
export function applyPronunciation(text: string, hints: PronunciationHints): string {
  // Keyed by lower case, because matching ignores case: a profile spelling of "Numerator"
  // has to replace the lexicon's "numerator" rather than race it.
  const merged = new Map<string, string>();
  for (const [written, spelling] of Object.entries(CURRICULUM_LEXICON)) {
    merged.set(written.toLowerCase(), spelling);
  }
  for (const [written, spelling] of Object.entries(hints)) {
    merged.set(written.toLowerCase(), spelling);
  }
  const entries = [...merged].sort(([left], [right]) => right.length - left.length);
  return entries.reduce(
    (spoken, [written, spelling]) => replaceWord(spoken, written, spelling),
    text,
  );
}

function replaceWord(text: string, written: string, spelling: string): string {
  const escaped = written.replace(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
  const pattern = new RegExp(String.raw`(^|\P{L})${escaped}(\P{L}|$)`, 'giu');
  // A function replacer, because a parent-supplied spelling containing `$&` must be text.
  return text.replace(
    pattern,
    (_match, before: string, after: string) => `${before}${spelling}${after}`,
  );
}
