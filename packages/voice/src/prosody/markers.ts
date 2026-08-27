/**
 * Prosody, written down.
 *
 * The tutor harness owns the words a child hears, so it owns how they are said. Authors write
 * two marks — `*word*` for emphasis and an ellipsis or a spaced em dash for a beat — and
 * `spokenForm` turns them into these vendor-neutral tokens. A vendor adapter is the only thing
 * that knows what its engine can do with them; one that can do nothing strips them, because a
 * child hearing "open square bracket pause" is worse than a child hearing no pause at all.
 *
 * Nothing on screen ever contains a token or an author mark, and that is structural rather
 * than a cleaning step: marks are authored into `speech.prosody`, a field no display path
 * reads. `hasProsody` is what the tests assert it with.
 */

export const EMPHASIS_OPEN = '[[emphasis]]';
export const EMPHASIS_CLOSE = '[[/emphasis]]';
export const PAUSE_SHORT = '[[pause:short]]';

/** `*word*`, never `2 * 3`: an author mark hugs the word it emphasises. */
const AUTHORED_EMPHASIS = /\*(\S[^*]*?)\*/gu;
const AUTHORED_PAUSE = /\s*(?:…|\.\.\.|\s—\s)\s*/gu;
const ANY_TOKEN = /\[\[\/?(?:emphasis|pause:short)\]\]/gu;

export type ProsodyMarker = 'emphasis' | 'pause';

/** Author marks become tokens. Anything else a vendor sees, it was given deliberately. */
export function markProsody(text: string): string {
  return text
    .replace(
      AUTHORED_EMPHASIS,
      (_match, word: string) => `${EMPHASIS_OPEN}${word}${EMPHASIS_CLOSE}`,
    )
    .replace(AUTHORED_PAUSE, ` ${PAUSE_SHORT} `);
}

/** Removes every token this vendor cannot render, so none of them is ever spoken literally. */
export function stripProsody(text: string, keep: ReadonlySet<ProsodyMarker> = new Set()): string {
  return tidy(
    text.replace(ANY_TOKEN, (token) =>
      keep.has(token.includes('pause') ? 'pause' : 'emphasis') ? token : '',
    ),
  );
}

/** True when a mark or a token survived somewhere it should not have (protocol test). */
export function hasProsody(text: string): boolean {
  // Fresh, un-global patterns: `test` on a `/g/` regex remembers where it stopped last time.
  return /\[\[\/?(?:emphasis|pause:short)\]\]/u.test(text) || /\*\S[^*]*?\*/u.test(text);
}

function tidy(text: string): string {
  return text.replace(/[^\S\n]{2,}/gu, ' ').replace(/[^\S\n]+([,.!?;:])/gu, '$1');
}
