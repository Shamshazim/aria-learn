import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';

/**
 * Comparing decimals to hundredths (4.NF.C.7). One place against two, so the length of a
 * decimal is always in play: sometimes the shorter is bigger (0.3, 0.25), sometimes smaller
 * (0.4, 0.75), and every sixth pair is equal with a trailing zero (0.5, 0.50). Both orders.
 */
type Pair = readonly [string, string];

const PAIRS: readonly Pair[] = Array.from({ length: 160 }, (_u, index): Pair[] => {
  const whole = index % 3;
  const tenths = 1 + (index % 9);
  if (index % 6 === 5)
    return [[`${String(whole)}.${String(tenths)}`, `${String(whole)}.${String(tenths)}0`]];
  let hundredths = 11 + ((index * 37) % 89);
  if (hundredths % 10 === 0) hundredths += 1;
  const short = `${String(whole)}.${String(tenths)}`;
  const long = `${String(whole)}.${String(hundredths).padStart(2, '0')}`;
  return index % 2 === 0 ? [[short, long]] : [[long, short]];
}).flat();

const UNIQUE: readonly Pair[] = [
  ...new Map(PAIRS.map((pair) => [pair.join('|'), pair] as const)).values(),
];

export const DEC_CMP_PARAMS: GeneratorParams = {
  skillCode: 'DEC.CMP',
  size: UNIQUE.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const pair = UNIQUE[index];
  if (pair === undefined) return null;
  const [left, right] = pair;
  // Hundredths as whole numbers, so the comparison here needs no floating point.
  const [a, b] = [hundredths(left), hundredths(right)];
  return {
    problem: { skillCode: 'DEC.CMP', kind: 'decimal-comparison', left, right },
    answer: a < b ? '<' : a > b ? '>' : '=',
  };
}

function hundredths(text: string): number {
  const [whole = '0', part = ''] = text.split('.');
  return Number(whole) * 100 + Number(part.padEnd(2, '0'));
}
