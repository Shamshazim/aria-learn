import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';

/** The division facts that undo `MUL.FACT.10` (3.OA.C.7): exact, so no remainder appears. */
const PAIRS: readonly (readonly [number, number])[] = Array.from({ length: 9 }, (_u, quotient) =>
  Array.from({ length: 9 }, (_v, divisor): readonly [number, number] => [
    (quotient + 2) * (divisor + 2),
    divisor + 2,
  ]),
).flat();

export const DIV_FACT_10_PARAMS: GeneratorParams = {
  skillCode: 'DIV.FACT.10',
  size: PAIRS.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const pair = PAIRS[index];
  if (pair === undefined) return null;
  const [dividend, divisor] = pair;
  return {
    problem: {
      skillCode: 'DIV.FACT.10',
      kind: 'division',
      left: String(dividend),
      right: String(divisor),
    },
    answer: String(dividend / divisor),
  };
}
