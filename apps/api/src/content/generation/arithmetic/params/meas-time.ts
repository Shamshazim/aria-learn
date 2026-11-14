import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';

/**
 * Elapsed time (3.MD.A.1) on a 12-hour clock, in five-minute steps, always crossing the hour
 * and staying under a hundred minutes past it: crossing is the skill, and "2:75" is only a
 * tell-tale answer while the minutes stay below a hundred.
 */
type Entry = readonly [number, number, number];

const ENTRIES: readonly Entry[] = Array.from({ length: 12 }, (_u, h) => h + 1)
  .flatMap((hour) =>
    Array.from({ length: 11 }, (_v, m) => (m + 1) * 5).flatMap((minute) =>
      [15, 20, 25, 30, 35, 40, 45, 50].map((added): Entry => [hour, minute, added]),
    ),
  )
  .filter(([, minute, added]) => minute + added >= 60 && minute + added < 100)
  .filter((_entry, index) => index % 4 === 0);

export const MEAS_TIME_PARAMS: GeneratorParams = {
  skillCode: 'MEAS.TIME',
  size: ENTRIES.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const entry = ENTRIES[index];
  if (entry === undefined) return null;
  const [hour, minute, added] = entry;
  const total = (hour % 12) * 60 + minute + added;
  const endHour = Math.floor((total % 720) / 60) || 12;
  return {
    problem: {
      skillCode: 'MEAS.TIME',
      kind: 'elapsed-time',
      start: `${String(hour)}:${String(minute).padStart(2, '0')}`,
      minutes: String(added),
    },
    answer: `${String(endHour)}:${String(total % 60).padStart(2, '0')}`,
  };
}
