import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';
import type { FractionOperation } from '@/quality/arithmetic';
import { formatFraction } from '@/quality/arithmetic/fraction-format';

/**
 * Adding and taking away fractions with the same denominator (4.NF.B.3.a), within one whole:
 * thirds to twelfths, sums that reach at most one and differences above zero. Fractions are
 * asked as written, reduced or not (3/6 + 1/6), as the standard introduces them. Adds and
 * takeaways alternate, so a short walk of the space sees both.
 */
type Entry = readonly [FractionOperation, number, number, number];

const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_u, index) => from + index);

const ADDS: readonly Entry[] = range(3, 12).flatMap((bottom) =>
  range(1, bottom - 1).flatMap((left) =>
    range(1, bottom - left).map((right): Entry => ['add', left, right, bottom]),
  ),
);
const TAKEAWAYS: readonly Entry[] = range(3, 12).flatMap((bottom) =>
  range(2, bottom - 1).flatMap((left) =>
    range(1, left - 1).map((right): Entry => ['subtract', left, right, bottom]),
  ),
);
const ENTRIES: readonly Entry[] = ADDS.flatMap((add, index) => {
  const takeaway = TAKEAWAYS[index];
  return takeaway === undefined ? [add] : [add, takeaway];
});

export const FRAC_ADD_LIKE_PARAMS: GeneratorParams = {
  skillCode: 'FRAC.ADD.LIKE',
  size: ENTRIES.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const entry = ENTRIES[index];
  if (entry === undefined) return null;
  const [operation, left, right, bottom] = entry;
  const top = operation === 'add' ? left + right : left - right;
  return {
    problem: {
      skillCode: 'FRAC.ADD.LIKE',
      kind: 'fraction-operation',
      operation,
      left: `${String(left)}/${String(bottom)}`,
      right: `${String(right)}/${String(bottom)}`,
    },
    answer: formatFraction({ numerator: BigInt(top), denominator: BigInt(bottom) }),
  };
}
