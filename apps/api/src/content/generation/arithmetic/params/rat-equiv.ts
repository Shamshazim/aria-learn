import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';

/**
 * Equivalent ratios (6.RP.A.3.a): "2 : 3 = 8 : ?". Two different terms from 2 to 12, scaled by
 * 2 to 6. The terms always differ, so adding the same amount to both — the commonest wrong
 * idea — always gives a different answer from scaling.
 */
type Entry = readonly [number, number, number];

const ENTRIES: readonly Entry[] = Array.from({ length: 8 }, (_u, a) => a + 2)
  .flatMap((first) =>
    Array.from({ length: 11 }, (_v, b) => b + 2)
      .filter((second) => second !== first)
      .flatMap((second) => [2, 3, 4, 5, 6].map((scale): Entry => [first, second, scale])),
  )
  .filter((_entry, index) => index % 3 === 0);

export const RAT_EQUIV_PARAMS: GeneratorParams = {
  skillCode: 'RAT.EQUIV',
  size: ENTRIES.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const entry = ENTRIES[index];
  if (entry === undefined) return null;
  const [first, second, scale] = entry;
  return {
    problem: {
      skillCode: 'RAT.EQUIV',
      kind: 'ratio-missing',
      first: String(first),
      second: String(second),
      scaledFirst: String(first * scale),
    },
    answer: String(second * scale),
  };
}
