/** One thing worth naming out of a whole session (P2H-11). */
export type RecapMoment = Readonly<{
  kind: 'after-reteach' | 'persistence' | 'first-correct';
  skillCode: string;
  skillName: string;
}>;

export type RecapSkill = Readonly<{ code: string; name: string }>;

/**
 * What actually happened in a session, in the few facts an ending can be built from (P2H-11).
 *
 * Counts are here so the *prompt* can be told how the session went; `master-plan.md` §14 says
 * a child never hears a number, and the claims check enforces that on the way out. Keeping the
 * counts and forbidding their mention is deliberate: "you got most of them" needs the count to
 * be true, and saying "eight out of ten" turns a session into a score.
 */
export type SessionRecap = Readonly<{
  skills: readonly RecapSkill[];
  attempted: number;
  correct: number;
  /** Correct answers at the end of the session with no wrong one after them. */
  finalStreak: number;
  moment: RecapMoment | null;
}>;
