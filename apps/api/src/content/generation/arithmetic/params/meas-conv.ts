import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';
import { CONVERSIONS } from '@/quality/arithmetic/units';

/**
 * Converting units (4.MD.A.1) by the fixed table in `units.ts`: from a bigger unit to a smaller
 * one, 2 to 12 of it, every conversion in the table in turn.
 */
type Entry = readonly [number, string, string, bigint];

const PAIRS = Object.entries(CONVERSIONS).flatMap(([from, targets]) =>
  Object.entries(targets).map(([to, factor]) => [from, to, factor] as const),
);

const ENTRIES: readonly Entry[] = Array.from({ length: 11 }, (_u, a) => a + 2).flatMap((amount) =>
  PAIRS.map(([from, to, factor]): Entry => [amount, from, to, factor]),
);

export const MEAS_CONV_PARAMS: GeneratorParams = {
  skillCode: 'MEAS.CONV',
  size: ENTRIES.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const entry = ENTRIES[index];
  if (entry === undefined) return null;
  const [amount, from, to, factor] = entry;
  return {
    problem: { skillCode: 'MEAS.CONV', kind: 'unit-conversion', amount: String(amount), from, to },
    answer: (BigInt(amount) * factor).toString(),
  };
}
