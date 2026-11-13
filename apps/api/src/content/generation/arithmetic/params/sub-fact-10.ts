import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';

/**
 * Subtraction facts within ten (1.OA.C.6): a whole from 2 to 10, take away 1 up to one less
 * than it. Taking away nothing or everything teaches nothing a child does not already know,
 * so neither appears: forty-five facts, the mirror of `ADD.FACT.10`.
 */
const PAIRS: readonly (readonly [number, number])[] = Array.from({ length: 9 }, (_u, whole) =>
  Array.from({ length: whole + 1 }, (_v, part): readonly [number, number] => [whole + 2, part + 1]),
).flat();

export const SUB_FACT_10_PARAMS: GeneratorParams = {
  skillCode: 'SUB.FACT.10',
  size: PAIRS.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const pair = PAIRS[index];
  if (pair === undefined) return null;
  const [left, right] = pair;
  return {
    problem: {
      skillCode: 'SUB.FACT.10',
      kind: 'subtraction',
      left: String(left),
      right: String(right),
    },
    answer: String(left - right),
  };
}
