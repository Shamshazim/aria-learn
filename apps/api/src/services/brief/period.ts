import type { BriefPeriod } from '@aria/shared';

/**
 * The time buckets a brief covers (P3-03, `master-plan.md` §4.2 "Time buckets"): the week from
 * Monday, the calendar month, and the school year from its start month (August by default).
 * All in UTC; a brief is a weekly paragraph, and the hour a week starts does not change it.
 */
export type PeriodWindow = Readonly<{ start: Date; end: Date; periodStart: string }>;

/** The parent-readable bar: ≤ 120 words for a week, ≤ 200 a month, ≤ 350 a year. */
export const WORD_CAP: Readonly<Record<BriefPeriod, number>> = { week: 120, month: 200, year: 350 };

export function periodWindow(
  period: BriefPeriod,
  at: Date,
  schoolYearStartMonth = 8,
): PeriodWindow {
  const year = at.getUTCFullYear();
  const month = at.getUTCMonth();
  if (period === 'week') {
    const day = (at.getUTCDay() + 6) % 7; // Monday = 0
    const start = new Date(Date.UTC(year, month, at.getUTCDate() - day));
    return window(start, new Date(start.getTime() + 7 * 86_400_000));
  }
  if (period === 'month') {
    return window(new Date(Date.UTC(year, month, 1)), new Date(Date.UTC(year, month + 1, 1)));
  }
  const startMonth = schoolYearStartMonth - 1;
  const startYear = month >= startMonth ? year : year - 1;
  return window(
    new Date(Date.UTC(startYear, startMonth, 1)),
    new Date(Date.UTC(startYear + 1, startMonth, 1)),
  );
}

function window(start: Date, end: Date): PeriodWindow {
  return { start, end, periodStart: start.toISOString().slice(0, 10) };
}
