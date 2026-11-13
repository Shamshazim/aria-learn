import { gcd } from '@/content/generation/arithmetic/params/frac-equiv';
import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';
import { formatFraction } from '@/quality/arithmetic/fraction-format';

/** A whole number from 2 to 6 times a proper fraction in lowest terms (4.NF.B.4.b). */
const ENTRIES: readonly (readonly [number, number, number])[] = [2, 3, 4, 5, 6].flatMap((whole) =>
  [2, 3, 4, 5, 6, 8, 10].flatMap((bottom) =>
    Array.from({ length: bottom - 1 }, (_u, index) => index + 1)
      .filter((top) => gcd(top, bottom) === 1)
      .map((top): readonly [number, number, number] => [whole, top, bottom]),
  ),
);

export const FRAC_MUL_WHOLE_PARAMS: GeneratorParams = {
  skillCode: 'FRAC.MUL.WHOLE',
  size: ENTRIES.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const entry = ENTRIES[index];
  if (entry === undefined) return null;
  const [whole, top, bottom] = entry;
  return {
    problem: {
      skillCode: 'FRAC.MUL.WHOLE',
      kind: 'fraction-operation',
      operation: 'multiply',
      left: String(whole),
      right: `${String(top)}/${String(bottom)}`,
    },
    answer: formatFraction({ numerator: BigInt(whole * top), denominator: BigInt(bottom) }),
  };
}
