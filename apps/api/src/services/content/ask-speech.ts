import type { Band, Speech } from '@aria/shared';

import { spokenForm } from '@/ai';
import { FUNCTION_WORDS } from '@/services/content/ask-speech.data';

/**
 * P2H-08: the word an early-band question turns on, said as if it mattered.
 *
 * "How many *quarters* make a whole?" is the same question a five-year-old was already going
 * to be asked, read the way a teacher reads it. Only the early band gets it: older children
 * hear a stress they did not need as being talked down to, and the register rules judge a
 * senior answer as a whole.
 *
 * The emphasis exists only in `speech.prosody`. `speech.text` and the display keep the plain
 * sentence, so nothing on screen ever shows a marker.
 */
export function askSpeech(prompt: string, band: Band): NonNullable<Speech> {
  if (band !== 'early') return { text: prompt };
  const noun = keyNoun(prompt);
  if (noun === null) return { text: prompt };
  return { text: prompt, prosody: spokenForm(markWord(prompt, noun)) };
}

/** Marks the whole word, so "quarter" cannot mark itself inside "quarters". */
function markWord(prompt: string, word: string): string {
  const pattern = new RegExp(String.raw`(^|\P{L})${escape(word)}(\P{L}|$)`, 'u');
  return prompt.replace(
    pattern,
    (_match, before: string, after: string) => `${before}*${word}*${after}`,
  );
}

function escape(word: string): string {
  return word.replace(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
}

/**
 * The noun a question is about, or nothing.
 *
 * "How many quarters make a whole?" leans on the word straight after "how many"; everything
 * else falls back to the last real word, which in an English question is almost always the
 * thing being asked about. A word that appears twice is left alone rather than guessed at,
 * because emphasising the wrong one of them is worse than emphasising neither.
 */
function keyNoun(prompt: string): string | null {
  const words = prompt.match(/\p{L}[\p{L}'-]*/gu) ?? [];
  const leadIn = words.findIndex((word, index) => {
    const next = words[index + 1]?.toLowerCase();
    return (
      (word.toLowerCase() === 'many' || word.toLowerCase() === 'which') &&
      next !== undefined &&
      !FUNCTION_WORDS.has(next)
    );
  });
  const candidate =
    leadIn === -1
      ? words.findLast((word) => !FUNCTION_WORDS.has(word.toLowerCase()))
      : words[leadIn + 1];
  if (candidate === undefined || candidate.length < 3) return null;
  // Case-insensitively: "Which shape matches this Shape?" is the same word twice.
  const folded = candidate.toLowerCase();
  return words.filter((word) => word.toLowerCase() === folded).length === 1 ? candidate : null;
}
