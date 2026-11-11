/** What the record says about one child and one misconception. */
export type MisconceptionHistory = Readonly<{
  /** Sightings ever, the one being graded now included once `sighted` has been applied. */
  seenCount: number;
  cleared: boolean;
}>;

/** Right answers on the skill, after a sighting, that clear the misconception. */
export const CLEARING_CORRECT = 3;

/**
 * §4.4: "when a misconception signature is seen twice she does not hint. She reteaches with
 * the fix." A cleared misconception has been unlearned; seeing it again un-clears it (that is
 * `sighted`), so the fix comes back the moment the wrong idea does.
 */
export function shouldReteachWithFix(history: MisconceptionHistory): boolean {
  return history.seenCount >= 2 && !history.cleared;
}

/** The history once the signature has been seen on this answer. */
export function sighted(history: MisconceptionHistory | null | undefined): MisconceptionHistory {
  return { seenCount: (history?.seenCount ?? 0) + 1, cleared: false };
}

/** Three right answers on the skill without the signature coming back clears it. */
export function isCleared(correctSinceSeen: number): boolean {
  return correctSinceSeen >= CLEARING_CORRECT;
}
