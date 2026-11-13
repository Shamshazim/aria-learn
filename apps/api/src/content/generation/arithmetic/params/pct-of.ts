import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';

/**
 * Percent of a quantity (6.RP.A.3.c), with the benchmark percents a child reasons from — ten
 * percent, a quarter, a half, three quarters, and their friends — and wholes that give a whole
 * number answer, so the skill is the percent and not long division.
 */
const PERCENTS = [10, 20, 25, 50, 75, 5, 40, 60, 30, 80, 90, 15] as const;
const WHOLES = [20, 40, 60, 80, 100, 120, 160, 200, 240, 300, 400, 500] as const;

const ENTRIES: readonly (readonly [number, number])[] = PERCENTS.flatMap((percent) =>
  WHOLES.filter((whole) => (percent * whole) % 100 === 0).map(
    (whole): readonly [number, number] => [percent, whole],
  ),
);

export const PCT_OF_PARAMS: GeneratorParams = {
  skillCode: 'PCT.OF',
  size: ENTRIES.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const entry = ENTRIES[index];
  if (entry === undefined) return null;
  const [percent, whole] = entry;
  return {
    problem: {
      skillCode: 'PCT.OF',
      kind: 'percent-of',
      percent: String(percent),
      whole: String(whole),
    },
    answer: String((percent * whole) / 100),
  };
}
