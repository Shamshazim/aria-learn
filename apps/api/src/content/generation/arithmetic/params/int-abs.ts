import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';

/**
 * Absolute value (6.NS.C.7.c), -40 to 19 without zero, negatives first and twice as often:
 * a positive number's absolute value is itself, and a skill made mostly of those would teach
 * nothing.
 */
const NUMBERS: readonly number[] = [
  ...Array.from({ length: 40 }, (_u, index) => -(index + 1)),
  ...Array.from({ length: 10 }, (_u, index) => index * 2 + 1),
];

export const INT_ABS_PARAMS: GeneratorParams = {
  skillCode: 'INT.ABS',
  size: NUMBERS.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const number = NUMBERS[index];
  if (number === undefined) return null;
  return {
    problem: { skillCode: 'INT.ABS', kind: 'absolute-value', number: String(number) },
    answer: String(Math.abs(number)),
  };
}
