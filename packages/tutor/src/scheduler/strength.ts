import type { GradedAttempt, SkillProgress } from './types';

/** `master-plan.md` §6: a fact that takes longer than this was counted, not recalled. */
export const AUTOMATIC_MS = 2_000;

const GAIN = 0.3;
const LOSS = 0.6;

/** A skill the child has never been graded on. */
export function freshProgress(skillCode: string): SkillProgress {
  return {
    skillCode,
    strength: 0,
    attempts: 0,
    streak: 0,
    lapses: 0,
    intervalDays: 0,
    lastSeenAt: null,
    nextDueAt: null,
  };
}

/**
 * What one graded answer does to a skill's strength (P3-04). Deterministic, no model.
 *
 * Right closes 30% of the gap to 1; wrong keeps 60% of what was there and counts a lapse. A
 * slow right answer on a facts skill is half-credit: half the gain, and the streak neither
 * grows nor breaks — the child knew it, but not yet the way a fact has to be known, so it must
 * not earn the long intervals a streak unlocks. An open response changes nothing.
 *
 * The interval and due date are left as they were; `schedule` in `interval.ts` sets them,
 * because only it knows the child's timezone.
 */
export function updateStrength(
  state: SkillProgress,
  graded: GradedAttempt,
  facts: boolean,
  now: Date,
): SkillProgress {
  if (graded.correct === null) return state;
  if (!graded.correct) {
    return {
      ...state,
      strength: clamp(state.strength * LOSS),
      attempts: state.attempts + 1,
      streak: 0,
      lapses: state.lapses + 1,
      lastSeenAt: now,
    };
  }
  const slow = facts && graded.latencyMs !== null && graded.latencyMs > AUTOMATIC_MS;
  const gain = (1 - state.strength) * GAIN * (slow ? 0.5 : 1);
  return {
    ...state,
    strength: clamp(state.strength + gain),
    attempts: state.attempts + 1,
    streak: slow ? state.streak : state.streak + 1,
    lastSeenAt: now,
  };
}

function clamp(value: number): number {
  // Three decimals is what `skill_state.strength NUMERIC(4,3)` keeps; rounding here means the
  // value a test sees is the value the database will hand back.
  return Math.round(Math.min(1, Math.max(0, value)) * 1000) / 1000;
}
