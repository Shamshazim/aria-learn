import type { SkillProgress } from './types';

const DAY_MS = 86_400_000;

/** The longest a strong skill goes unseen. */
export const MAX_INTERVAL_DAYS = 60;

const STRONG_DAYS = 21;
const STREAK_MULTIPLIER = 1.5;
/** The streak at which a strong skill's interval starts to stretch. */
const STRETCH_FROM_STREAK = 5;

/**
 * The strength → interval table (P3-04).
 *
 * <0.3 tomorrow, 0.3–0.6 three days, 0.6–0.8 a week, ≥0.8 three weeks — stretched ×1.5 for
 * every right answer in a row from the fifth, up to sixty days. A lapse zeroes the streak, so
 * the stretch starts again from nothing.
 *
 * Nothing here reads the clock. How long a child was away has no say in how long the next gap
 * is, which is what keeps a missed week from ever shortening an interval (§14: no punishing
 * streak).
 */
export function intervalDays(strength: number, streak: number): number {
  if (strength < 0.3) return 1;
  if (strength < 0.6) return 3;
  if (strength < 0.8) return 7;
  const stretches = Math.max(0, streak - STRETCH_FROM_STREAK + 1);
  return Math.min(MAX_INTERVAL_DAYS, round2(STRONG_DAYS * STREAK_MULTIPLIER ** stretches));
}

/**
 * Sets the interval and the due date on progress that `updateStrength` has just changed.
 *
 * Days are the child's days, not UTC's: "tomorrow" is the next midnight where the child is,
 * so a session at 23:30 and one at 00:10 are on different days, and a skill due "in three
 * days" is due from the start of that day rather than at the minute it was last answered.
 */
export function schedule(progress: SkillProgress, now: Date, timeZone: string): SkillProgress {
  const days = intervalDays(progress.strength, progress.streak);
  return { ...progress, intervalDays: days, nextDueAt: nextDueAt(days, now, timeZone) };
}

export function nextDueAt(days: number, now: Date, timeZone: string): Date {
  const today = localDate(now, timeZone);
  const due = new Date(Date.UTC(today.year, today.month - 1, today.day) + Math.ceil(days) * DAY_MS);
  return startOfLocalDay(due, timeZone);
}

/** A timezone this runtime knows, or UTC. A stored value is parsed, never trusted. */
export function resolveTimeZone(candidate: string | null | undefined): string {
  if (candidate === null || candidate === undefined || candidate === '') return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate });
    return candidate;
  } catch {
    return 'UTC';
  }
}

type LocalDate = Readonly<{ year: number; month: number; day: number }>;

function localDate(at: Date, timeZone: string): LocalDate {
  const parts = partsOf(at, timeZone);
  return { year: parts.year, month: parts.month, day: parts.day };
}

/** The instant local midnight begins on the calendar date `utcDate` names. */
function startOfLocalDay(utcDate: Date, timeZone: string): Date {
  const guess = utcDate.getTime();
  // Twice, because the offset at the guess and the offset at local midnight can differ on
  // the day a clock changes.
  const first = guess - offsetMs(new Date(guess), timeZone);
  return new Date(guess - offsetMs(new Date(first), timeZone));
}

function offsetMs(at: Date, timeZone: string): number {
  const parts = partsOf(at, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

type Parts = LocalDate & Readonly<{ hour: number; minute: number; second: number }>;

function partsOf(at: Date, timeZone: string): Parts {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(at);
  const value = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(formatted.find((part) => part.type === type)?.value ?? '0');
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
