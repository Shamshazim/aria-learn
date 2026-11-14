import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';

/**
 * Comparing integers from -20 to 20 (6.NS.C.7.b). Half the pairs are two negatives, where the
 * size-not-sign idea lives (-7 against -3); the rest mix signs, put zero against a negative,
 * or are equal. Pairs are spread with two different steps so both orders turn up.
 */
type Pair = readonly [number, number];

const PAIRS: readonly Pair[] = Array.from({ length: 180 }, (_u, index): Pair => {
  if (index % 2 === 0) return [-1 - ((index * 7) % 20), -1 - ((index * 3 + 5) % 20)];
  if (index % 10 === 1) return [0, -1 - (index % 20)];
  if (index % 10 === 3) return [-1 - (index % 20), 0];
  return [-20 + ((index * 7) % 41), -20 + ((index * 11) % 41)];
});

const UNIQUE: readonly Pair[] = [
  ...new Map(PAIRS.map((pair) => [pair.join('|'), pair] as const)).values(),
];

export const INT_CMP_PARAMS: GeneratorParams = {
  skillCode: 'INT.CMP',
  size: UNIQUE.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const pair = UNIQUE[index];
  if (pair === undefined) return null;
  const [left, right] = pair;
  return {
    problem: {
      skillCode: 'INT.CMP',
      kind: 'integer-comparison',
      left: String(left),
      right: String(right),
    },
    answer: left < right ? '<' : left > right ? '>' : '=',
  };
}
