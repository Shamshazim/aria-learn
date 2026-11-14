import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';
import { formatDecimal } from '@/quality/arithmetic/decimal-format';

/**
 * Mean and median (6.SP.B.5.c) of four to seven numbers from 1 to 20, written out of order.
 * A mean is asked only where it comes out whole; a median only where the middle of the list as
 * written is not the median, so sorting is what gets it right.
 */
type Entry = readonly [readonly number[], 'mean' | 'median'];

/** A seeded generator, so the lists are varied and the same on every run. */
function lists(count: number): readonly (readonly number[])[] {
  let state = 12_345;
  const next = (): number => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
  return Array.from({ length: count }, (_u, index) =>
    Array.from({ length: 4 + (index % 4) }, () => 1 + Math.floor(next() * 20)),
  );
}

const LISTS = lists(600);

const ENTRIES: readonly Entry[] = LISTS.flatMap((values, index): Entry[] => {
  const measure = index % 2 === 0 ? 'mean' : 'median';
  const sum = values.reduce((total, value) => total + value, 0);
  if (measure === 'mean') return sum % values.length === 0 ? [[values, 'mean']] : [];
  return middleOf(values) === middleOf([...values].sort((a, b) => a - b))
    ? []
    : [[values, 'median']];
}).filter((_entry, index) => index % 2 === 0);

export const DATA_MEAN_PARAMS: GeneratorParams = {
  skillCode: 'DATA.MEAN',
  size: ENTRIES.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const entry = ENTRIES[index];
  if (entry === undefined) return null;
  const [values, measure] = entry;
  const answer =
    measure === 'mean'
      ? String(values.reduce((total, value) => total + value, 0) / values.length)
      : middleOf([...values].sort((a, b) => a - b));
  return {
    problem: { skillCode: 'DATA.MEAN', kind: 'statistic', values: values.map(String), measure },
    answer,
  };
}

/** The middle value, or the mean of the middle two, written as a decimal. */
function middleOf(values: readonly number[]): string {
  const half = Math.floor(values.length / 2);
  const upper = values[half] ?? 0;
  const lower = values[half - 1] ?? upper;
  const doubled = values.length % 2 === 1 ? upper * 2 : lower + upper;
  return formatDecimal({ numerator: BigInt(doubled), denominator: 2n }) ?? '';
}
