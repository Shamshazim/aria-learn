import type { EpisodeKind } from '@aria/shared';

const DAY_MS = 86_400_000;

/**
 * How long a remembered thing lasts (P3-02). A mood is an observation about one session, not a
 * fact about a child, so it lasts a day; a preference lasts half a year unless it is seen
 * again; what helped a child learn lasts a year. Re-observing a fact refreshes its clock —
 * `confirm` writes a new expiry from the new date — so only what stops being true lapses.
 * `null` means it does not expire.
 */
const FACT_DAYS: Readonly<Record<string, number>> = {
  mood: 1,
  engagement: 1,
  engagement_state: 1,
  temporary_preference: 1,
  preference: 180,
  teaching_response: 365,
};

/** Breakthroughs and reached goals are kept; a hard day is not worth remembering forever. */
const EPISODE_DAYS: Readonly<Record<EpisodeKind, number | null>> = {
  breakthrough: null,
  goal_reached: null,
  struggle: 90,
  return_after_absence: 90,
  preference_change: 180,
  other: 180,
};

export function factExpiresAt(
  kind: string,
  now: Date,
  options: Readonly<{ goalEndsAt?: Date | null }> = {},
): Date | null {
  if (kind === 'goal') return options.goalEndsAt ?? null;
  const days = FACT_DAYS[kind];
  return days === undefined ? null : new Date(now.getTime() + days * DAY_MS);
}

export function episodeExpiresAt(kind: EpisodeKind, at: Date): Date | null {
  const days = EPISODE_DAYS[kind];
  return days === null ? null : new Date(at.getTime() + days * DAY_MS);
}

/** An observation is a candidate, kept a week so a repeat can promote it (P1-09). */
const OBSERVATION_DAYS = 7;

export function observationExpiresAt(now: Date, temporary: boolean): Date {
  return new Date(now.getTime() + (temporary ? 1 : OBSERVATION_DAYS) * DAY_MS);
}
