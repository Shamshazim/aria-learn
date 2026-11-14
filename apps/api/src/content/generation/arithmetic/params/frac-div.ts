import { gcd } from '@/content/generation/arithmetic/params/frac-equiv';
import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';
import { procedureSteps, type ArithmeticProblem } from '@/quality/arithmetic';
import { formatFraction } from '@/quality/arithmetic/fraction-format';

/**
 * Dividing fractions (6.NS.A.1): two proper fractions in lowest terms, the divisor most often a
 * unit fraction ("how many eighths in three quarters?"), which is how the idea is introduced.
 * An item whose worked steps would show the answer before the child reaches it is not asked.
 */
const DENOMINATORS = [2, 3, 4, 5, 6, 8, 10, 12] as const;

function proper(bottom: number): number[] {
  return Array.from({ length: bottom - 1 }, (_u, index) => index + 1).filter(
    (top) => gcd(top, bottom) === 1,
  );
}

const PAIRS = DENOMINATORS.flatMap((leftBottom) =>
  proper(leftBottom).flatMap((leftTop) =>
    DENOMINATORS.flatMap((rightBottom) =>
      proper(rightBottom)
        .filter((rightTop) => rightTop === 1 || (leftTop + rightBottom) % 3 === 0)
        .map((rightTop) => [leftTop, leftBottom, rightTop, rightBottom] as const),
    ),
  ),
);

const ITEMS: readonly CandidateItem[] = PAIRS.map(([a, b, c, d]): CandidateItem => {
  const problem: ArithmeticProblem = {
    skillCode: 'FRAC.DIV',
    kind: 'fraction-operation',
    operation: 'divide',
    left: `${String(a)}/${String(b)}`,
    right: `${String(c)}/${String(d)}`,
  };
  return {
    problem,
    answer: formatFraction({ numerator: BigInt(a * d), denominator: BigInt(b * c) }),
  };
})
  .filter((item) =>
    procedureSteps(item.problem).every((step) => !step.prompt.includes(item.answer)),
  )
  .filter((_item, index) => index % 4 === 0);

export const FRAC_DIV_PARAMS: GeneratorParams = {
  skillCode: 'FRAC.DIV',
  size: ITEMS.length,
  at: (index) => ITEMS[index] ?? null,
};
