import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';
import { formatDecimal } from '@/quality/arithmetic/decimal-format';

/**
 * Adding and taking away decimals to hundredths (5.NBT.B.7), with one number in tenths and
 * the other in hundredths, so the points have to be lined up and a column carries an empty
 * place. The hundredths digit is never zero, so no answer is a whole number. Adds and
 * takeaways alternate; a takeaway is asked only where the first number is the bigger.
 */
type Entry = readonly ['add' | 'subtract', number, number];

const ENTRIES: readonly Entry[] = Array.from({ length: 400 }, (_u, index): Entry => {
  let tenths = 11 + ((index * 7) % 89);
  // A whole number of tenths would be a whole number, and the skill needs a point to line up.
  if (tenths % 10 === 0) tenths += 1;
  let hundredths = 101 + ((index * 53) % 898);
  if (hundredths % 10 === 0) hundredths += 1;
  // Tenths as hundredths, so the sum below is whole-number arithmetic.
  const [first, second] = index % 4 < 2 ? [tenths * 10, hundredths] : [hundredths, tenths * 10];
  const subtract = index % 2 === 1 && first > second;
  return [subtract ? 'subtract' : 'add', first, second];
});

export const DEC_ADD_PARAMS: GeneratorParams = {
  skillCode: 'DEC.ADD',
  size: ENTRIES.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const entry = ENTRIES[index];
  if (entry === undefined) return null;
  const [operation, first, second] = entry;
  const result = operation === 'add' ? first + second : first - second;
  return {
    problem: {
      skillCode: 'DEC.ADD',
      kind: 'decimal-operation',
      operation,
      left: written(first),
      right: written(second),
    },
    answer: formatDecimal({ numerator: BigInt(result), denominator: 100n }) ?? '',
  };
}

/** Hundredths back to the decimal as written: 340 is "3.4", 125 is "1.25". */
function written(hundredths: number): string {
  return formatDecimal({ numerator: BigInt(hundredths), denominator: 100n }) ?? '';
}
