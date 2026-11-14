import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';

/**
 * Adding and taking away integers from -10 to 10 (7.NS.A.1), always with at least one negative
 * and never with zero, alternating add and take away so "take away a negative" is as common as
 * "add a negative".
 */
type Entry = readonly ['add' | 'subtract', number, number];

const VALUES = Array.from({ length: 21 }, (_u, index) => index - 10).filter((value) => value !== 0);

const ENTRIES: readonly Entry[] = VALUES.flatMap((left) =>
  VALUES.filter((right) => left < 0 || right < 0).map((right, index): Entry => [
    index % 2 === 0 ? 'add' : 'subtract',
    left,
    right,
  ]),
);

export const INT_ADD_PARAMS: GeneratorParams = {
  skillCode: 'INT.ADD',
  size: ENTRIES.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const entry = ENTRIES[index];
  if (entry === undefined) return null;
  const [operation, left, right] = entry;
  return {
    problem: {
      skillCode: 'INT.ADD',
      kind: 'integer-operation',
      operation,
      left: String(left),
      right: String(right),
    },
    answer: String(operation === 'add' ? left + right : left - right),
  };
}
