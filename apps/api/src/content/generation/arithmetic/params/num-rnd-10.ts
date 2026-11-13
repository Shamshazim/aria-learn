import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';

/**
 * Rounding a whole number to the nearest ten (3.NBT.A.1).
 *
 * Every number from 11 to 999 whose ones digit is not zero, walked in a stride that puts the
 * halfway cases (ending in 5) and both directions near the front. A multiple of ten is left
 * out: it rounds to itself, which teaches nothing about rounding.
 */
const NUMBERS: readonly number[] = Array.from(
  { length: 989 },
  (_u, index) => 11 + ((index * 97) % 989),
).filter((number) => number % 10 !== 0);

export const NUM_RND_10_PARAMS: GeneratorParams = {
  skillCode: 'NUM.RND.10',
  size: NUMBERS.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const number = NUMBERS[index];
  if (number === undefined) return null;
  const ones = number % 10;
  return {
    problem: { skillCode: 'NUM.RND.10', kind: 'rounding', number: String(number), to: '10' },
    answer: String(ones >= 5 ? number - ones + 10 : number - ones),
  };
}
