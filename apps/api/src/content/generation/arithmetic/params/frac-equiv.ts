import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';

/**
 * "2/3 = ?/12" (4.NF.A.1): a fraction in lowest terms, scaled by 2–5 to a denominator no
 * bigger than 30. Lowest terms on the left, so the only way to the answer is to scale up.
 */
const DENOMINATORS = [2, 3, 4, 5, 6, 8, 10] as const;

const ITEMS: readonly (readonly [number, number, number])[] = DENOMINATORS.flatMap((bottom) =>
  Array.from({ length: bottom - 1 }, (_u, index) => index + 1)
    .filter((top) => gcd(top, bottom) === 1)
    .flatMap((top) =>
      [2, 3, 4, 5]
        .filter((factor) => bottom * factor <= 30)
        .map((factor): readonly [number, number, number] => [top, bottom, factor]),
    ),
);

export const FRAC_EQUIV_PARAMS: GeneratorParams = {
  skillCode: 'FRAC.EQUIV',
  size: ITEMS.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const entry = ITEMS[index];
  if (entry === undefined) return null;
  const [top, bottom, factor] = entry;
  return {
    problem: {
      skillCode: 'FRAC.EQUIV',
      kind: 'fraction-missing',
      left: `${String(top)}/${String(bottom)}`,
      denominator: String(bottom * factor),
    },
    answer: String(top * factor),
  };
}

export function gcd(left: number, right: number): number {
  return right === 0 ? left : gcd(right, left % right);
}
