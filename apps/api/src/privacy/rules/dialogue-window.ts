import type { RawDialogueTurn, ScrubbedDialogueTurn } from '@/privacy/types';

/**
 * The conversation window, bounded and cleaned (P2H-04).
 *
 * Two rules that are not redaction:
 *
 * A turn our safety check flagged never reaches a vendor at all — not redacted word by word,
 * removed. A child disclosing something serious said it to Aria, not to a model provider, and
 * a partial redaction of "my dad hits me" is still a sentence about a child's home.
 *
 * The window is then capped in tokens, oldest first. A long session would otherwise grow the
 * prompt until the cost cap or the context limit decided where to cut, and neither of those
 * knows that the last three turns matter more than the first thirty.
 */
export const DIALOGUE_TOKEN_CAP = 1_500;

export const SAFETY_REDACTION = '[redacted: safety]';

/** Four characters to a token: the vendor-neutral rule of thumb. See `aria.persona.test.ts`. */
const CHARS_PER_TOKEN = 4;

/** A speaker label and a line break ride along with every turn in the rendered block. */
const TOKENS_PER_TURN_OVERHEAD = 4;

export function redactFlaggedTurns(turns: readonly RawDialogueTurn[]): readonly RawDialogueTurn[] {
  return turns.map((turn) =>
    turn.safetyFlagged === true ? { ...turn, text: SAFETY_REDACTION } : turn,
  );
}

/** Drops whole turns from the front until the window fits. Never truncates mid-sentence. */
export function capDialogueTokens(
  turns: readonly ScrubbedDialogueTurn[],
  cap: number = DIALOGUE_TOKEN_CAP,
): readonly ScrubbedDialogueTurn[] {
  const kept = [...turns];
  while (kept.length > 0 && estimateDialogueTokens(kept) > cap) kept.shift();
  return kept;
}

export function estimateDialogueTokens(turns: readonly ScrubbedDialogueTurn[]): number {
  return turns.reduce(
    (total, turn) =>
      total + Math.ceil(turn.text.length / CHARS_PER_TOKEN) + TOKENS_PER_TURN_OVERHEAD,
    0,
  );
}
