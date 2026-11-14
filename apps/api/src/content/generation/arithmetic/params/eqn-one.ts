import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';

/**
 * One-step equations (6.EE.B.7): x + a = b, x - a = b, ax = b and x ÷ a = b, with a whole
 * solution from 2 to 20 and a from 2 to 12. The four forms rotate, so each inverse is asked.
 */
type Entry = readonly [string, string, number];

const ENTRIES: readonly Entry[] = Array.from({ length: 19 }, (_u, s) => s + 2)
  .flatMap((solution) =>
    Array.from({ length: 11 }, (_v, n) => n + 2).map((a, index): Entry => {
      switch ((solution + index) % 4) {
        case 0:
          return [`x + ${String(a)}`, String(solution + a), solution];
        case 1:
          return [`x - ${String(a)}`, String(solution - a), solution];
        case 2:
          return [`${String(a)}x`, String(solution * a), solution];
        default:
          return [`x ÷ ${String(a)}`, String(solution), solution * a];
      }
    }),
  )
  .filter(([, right]) => Number(right) >= 0);

export const EQN_ONE_PARAMS: GeneratorParams = {
  skillCode: 'EQN.ONE',
  size: ENTRIES.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const entry = ENTRIES[index];
  if (entry === undefined) return null;
  const [left, right, solution] = entry;
  return {
    problem: { skillCode: 'EQN.ONE', kind: 'equation', left, right, variable: 'x' },
    answer: String(solution),
  };
}
