import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';

/**
 * Comparing two two-digit numbers with <, > or = (1.NBT.B.3).
 *
 * The pairs are chosen to separate the wrong ideas from the right one: some share a tens digit
 * (so only the ones decide), some have the larger ones digit on the smaller number (so
 * "compare the ones" fails), and a few are equal. Walked in a fixed interleaved order, so the
 * first forty items already mix all three.
 */
type Pair = readonly [left: number, right: number];

const SAME_TENS: readonly Pair[] = Array.from({ length: 9 }, (_u, tens) => [
  (tens + 1) * 10 + 2,
  (tens + 1) * 10 + 7,
]);
const ONES_MISLEAD: readonly Pair[] = Array.from({ length: 8 }, (_u, tens) => [
  (tens + 1) * 10 + 9,
  (tens + 2) * 10 + 1,
]);
const EQUAL: readonly Pair[] = [23, 46, 58, 71, 94].map((value) => [value, value]);
const SPREAD: readonly Pair[] = Array.from({ length: 60 }, (_u, index) => [
  10 + ((index * 37) % 90),
  10 + ((index * 53 + 11) % 90),
]);

const PAIRS: readonly Pair[] = unique(
  interleave([SAME_TENS, ONES_MISLEAD, EQUAL, SPREAD]).flatMap(([left, right]): Pair[] =>
    left === right
      ? [[left, right]]
      : [
          [left, right],
          [right, left],
        ],
  ),
);

export const NUM_CMP_100_PARAMS: GeneratorParams = {
  skillCode: 'NUM.CMP.100',
  size: PAIRS.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const pair = PAIRS[index];
  if (pair === undefined) return null;
  const [left, right] = pair;
  return {
    problem: {
      skillCode: 'NUM.CMP.100',
      kind: 'whole-comparison',
      left: String(left),
      right: String(right),
    },
    answer: left < right ? '<' : left > right ? '>' : '=',
  };
}

/** A pair the spread meets twice, or meets mirrored, is still one item. */
function unique(pairs: readonly Pair[]): readonly Pair[] {
  const seen = new Set<string>();
  return pairs.filter(([left, right]) => {
    const key = `${String(left)}|${String(right)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function interleave(groups: readonly (readonly Pair[])[]): readonly Pair[] {
  const longest = Math.max(...groups.map((group) => group.length));
  return Array.from({ length: longest }, (_u, index) =>
    groups.flatMap((group) => (group[index] === undefined ? [] : [group[index]])),
  ).flat();
}
