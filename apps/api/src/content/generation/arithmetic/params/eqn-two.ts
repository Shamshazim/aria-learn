import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';
import { procedureSteps } from '@/quality/arithmetic';

/**
 * Two-step equations (7.EE.B.4.a): px + q = r and px - q = r, with p from 2 to 9, q from 1 to
 * 15 and a whole solution from 2 to 15. An item whose worked steps would show the answer
 * before the child reaches it is not asked.
 */
type Entry = readonly [number, number, number, boolean];

const ITEMS: readonly CandidateItem[] = Array.from({ length: 8 }, (_u, p) => p + 2)
  .flatMap((p) =>
    Array.from({ length: 14 }, (_v, s) => s + 2).map((solution, index): Entry => [
      p,
      1 + ((p * 7 + index * 5) % 15),
      solution,
      (p + index) % 2 === 0,
    ]),
  )
  .map(([p, q, solution, plus]): CandidateItem => {
    const right = plus ? p * solution + q : p * solution - q;
    return {
      problem: {
        skillCode: 'EQN.TWO',
        kind: 'equation',
        left: `${String(p)}x ${plus ? '+' : '-'} ${String(q)}`,
        right: String(right),
        variable: 'x',
      },
      answer: String(solution),
    };
  })
  .filter((item) => item.problem.kind === 'equation' && Number(item.problem.right) >= 0)
  .filter((item) =>
    procedureSteps(item.problem).every((step) => !step.prompt.includes(item.answer)),
  );

export const EQN_TWO_PARAMS: GeneratorParams = {
  skillCode: 'EQN.TWO',
  size: ITEMS.length,
  at: (index) => ITEMS[index] ?? null,
};
