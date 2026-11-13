import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';

/**
 * Three-digit addition within 1000 (3.NBT.A.2), with at least one trade.
 *
 * The full space is a third of a million pairs; this is a spread across it, the left number
 * stepping by 7 and the right by 11, so every hundreds digit and every kind of trade (ones,
 * tens, both) turns up without the list being too long to read in a test.
 */
const PAIRS: readonly (readonly [number, number])[] = Array.from({ length: 115 }, (_u, a) =>
  Array.from({ length: 73 }, (_v, b): readonly [number, number] => [101 + a * 7, 102 + b * 11]),
)
  .flat()
  .filter(([left, right]) => left + right <= 999 && regroups(left, right));

function regroups(left: number, right: number): boolean {
  return (
    (left % 10) + (right % 10) >= 10 ||
    (Math.floor(left / 10) % 10) + (Math.floor(right / 10) % 10) >= 10
  );
}

export const ADD_3D_PARAMS: GeneratorParams = {
  skillCode: 'ADD.3D',
  size: PAIRS.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const pair = PAIRS[index];
  if (pair === undefined) return null;
  const [left, right] = pair;
  return {
    problem: { skillCode: 'ADD.3D', kind: 'addition', left: String(left), right: String(right) },
    answer: String(left + right),
  };
}
