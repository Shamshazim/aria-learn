import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';

/**
 * Three-digit numbers divided by one-digit numbers (4.NBT.B.6), remainders included.
 *
 * A spread rather than the whole space: the dividend steps by 37 through 100–999 and the
 * divisor cycles 3–9, so the list holds quotients with a zero in the middle (412 ÷ 4), exact
 * ones and ones with something left over, without growing past what a test can walk.
 */
const PAIRS: readonly (readonly [number, number])[] = [
  ...new Map(
    Array.from({ length: 700 }, (_u, index): readonly [number, number] => [
      100 + ((index * 37) % 900),
      3 + (index % 7),
    ]).map((pair) => [`${String(pair[0])}/${String(pair[1])}`, pair] as const),
  ).values(),
];

export const DIV_LONG_PARAMS: GeneratorParams = {
  skillCode: 'DIV.LONG',
  size: PAIRS.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const pair = PAIRS[index];
  if (pair === undefined) return null;
  const [dividend, divisor] = pair;
  const quotient = Math.floor(dividend / divisor);
  const remainder = dividend % divisor;
  return {
    problem: {
      skillCode: 'DIV.LONG',
      kind: 'division',
      left: String(dividend),
      right: String(divisor),
    },
    answer: remainder === 0 ? String(quotient) : `${String(quotient)} r ${String(remainder)}`,
  };
}
