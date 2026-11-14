import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';

/**
 * Unit rates (6.RP.A.2): "48 km in 4 hours. How many km in 1 hour?" Everyday rates with a
 * whole-number answer from 3 to 12, over 2 to 9 units of time or turns.
 */
const CONTEXTS = [
  ['km', 'hour'],
  ['pages', 'day'],
  ['words', 'minute'],
  ['points', 'game'],
  ['litres', 'minute'],
] as const;

type Entry = readonly [number, number, (typeof CONTEXTS)[number]];

const ENTRIES: readonly Entry[] = Array.from({ length: 10 }, (_u, r) => r + 3).flatMap((rate) =>
  Array.from({ length: 8 }, (_v, p) => p + 2).map((per, index): Entry => [
    rate,
    per,
    CONTEXTS[(rate + index) % CONTEXTS.length] ?? CONTEXTS[0],
  ]),
);

export const RAT_UNIT_PARAMS: GeneratorParams = {
  skillCode: 'RAT.UNIT',
  size: ENTRIES.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const entry = ENTRIES[index];
  if (entry === undefined) return null;
  const [rate, per, [amountUnit, perUnit]] = entry;
  return {
    problem: {
      skillCode: 'RAT.UNIT',
      kind: 'unit-rate',
      amount: String(rate * per),
      per: String(per),
      amountUnit,
      perUnit,
    },
    answer: String(rate),
  };
}
