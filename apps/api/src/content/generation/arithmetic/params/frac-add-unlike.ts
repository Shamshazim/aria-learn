import { gcd } from '@/content/generation/arithmetic/params/frac-equiv';
import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';
import type { FractionOperation } from '@/quality/arithmetic';
import { formatFraction } from '@/quality/arithmetic/fraction-format';

/**
 * Adding and taking away fractions with different denominators (5.NF.A.1). Both fractions in
 * lowest terms, denominators different and with a common multiple no bigger than 24, and a
 * takeaway only where the first is the bigger. Answers above one are allowed (5/6 + 3/4).
 */
type Entry = readonly [FractionOperation, number, number, number, number];

const DENOMINATORS = [2, 3, 4, 5, 6, 8, 10, 12] as const;

function proper(bottom: number): number[] {
  return Array.from({ length: bottom - 1 }, (_u, index) => index + 1).filter(
    (top) => gcd(top, bottom) === 1,
  );
}

const ENTRIES: readonly Entry[] = DENOMINATORS.flatMap((leftBottom) =>
  DENOMINATORS.filter(
    (rightBottom) =>
      rightBottom !== leftBottom && (leftBottom * rightBottom) / gcd(leftBottom, rightBottom) <= 24,
  ).flatMap((rightBottom) =>
    proper(leftBottom).flatMap((leftTop) =>
      proper(rightBottom).flatMap((rightTop): Entry[] => {
        const add: Entry = ['add', leftTop, leftBottom, rightTop, rightBottom];
        const bigger = leftTop * rightBottom > rightTop * leftBottom;
        return bigger ? [add, ['subtract', leftTop, leftBottom, rightTop, rightBottom]] : [add];
      }),
    ),
  ),
);

export const FRAC_ADD_UNLIKE_PARAMS: GeneratorParams = {
  skillCode: 'FRAC.ADD.UNLIKE',
  size: ENTRIES.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const entry = ENTRIES[index];
  if (entry === undefined) return null;
  const [operation, leftTop, leftBottom, rightTop, rightBottom] = entry;
  const cross = leftTop * rightBottom + (operation === 'add' ? 1 : -1) * rightTop * leftBottom;
  return {
    problem: {
      skillCode: 'FRAC.ADD.UNLIKE',
      kind: 'fraction-operation',
      operation,
      left: `${String(leftTop)}/${String(leftBottom)}`,
      right: `${String(rightTop)}/${String(rightBottom)}`,
    },
    answer: formatFraction({
      numerator: BigInt(cross),
      denominator: BigInt(leftBottom * rightBottom),
    }),
  };
}
