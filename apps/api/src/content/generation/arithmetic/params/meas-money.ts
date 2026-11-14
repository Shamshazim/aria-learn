import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';

/**
 * Making change (4.MD.A.2): a whole-dollar payment of $1, $2, $5, $10 or $20 for a price below
 * it that is not a whole dollar, so the cents column always needs a trade.
 */
type Entry = readonly [number, number];

const ENTRIES: readonly Entry[] = [1, 2, 5, 10, 20].flatMap((paid) =>
  Array.from({ length: 40 }, (_u, index) => 5 + ((index * 137 + paid * 31) % (paid * 100 - 5)))
    .filter((cost) => cost % 100 !== 0)
    .map((cost): Entry => [paid * 100, cost]),
);

const UNIQUE: readonly Entry[] = [
  ...new Map(ENTRIES.map((entry) => [entry.join('|'), entry] as const)).values(),
];

export const MEAS_MONEY_PARAMS: GeneratorParams = {
  skillCode: 'MEAS.MONEY',
  size: UNIQUE.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const entry = UNIQUE[index];
  if (entry === undefined) return null;
  const [paid, cost] = entry;
  return {
    problem: {
      skillCode: 'MEAS.MONEY',
      kind: 'money-change',
      paid: money(paid),
      cost: money(cost),
    },
    answer: `$${money(paid - cost)}`,
  };
}

/** Cents as a price without the sign: 345 is "3.45". */
function money(cents: number): string {
  return `${String(Math.floor(cents / 100))}.${String(cents % 100).padStart(2, '0')}`;
}
