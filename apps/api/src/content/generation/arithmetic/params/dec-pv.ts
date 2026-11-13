import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';

/**
 * Tenths and hundredths (5.NBT.A.3): numbers d.dd with three different digits, so "the digit
 * in the next place" and "the ones digit" are always different answers from the right one.
 * Every seventh such number, asked both ways.
 */
const NUMBERS: readonly string[] = Array.from({ length: 1000 }, (_u, value) => value)
  .filter((value) => {
    const [ones, tenths, hundredths] = [
      Math.floor(value / 100),
      Math.floor(value / 10) % 10,
      value % 10,
    ];
    return hundredths !== 0 && ones !== tenths && tenths !== hundredths && ones !== hundredths;
  })
  .filter((_value, index) => index % 7 === 0)
  .map((value) => `${String(Math.floor(value / 100))}.${String(value % 100).padStart(2, '0')}`);

const ITEMS = NUMBERS.flatMap((number) => [
  { number, place: 'tenths' as const },
  { number, place: 'hundredths' as const },
]);

export const DEC_PV_PARAMS: GeneratorParams = {
  skillCode: 'DEC.PV',
  size: ITEMS.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const entry = ITEMS[index];
  if (entry === undefined) return null;
  const digits = entry.number.split('.')[1] ?? '';
  return {
    problem: {
      skillCode: 'DEC.PV',
      kind: 'decimal-place',
      number: entry.number,
      place: entry.place,
    },
    answer: digits[entry.place === 'tenths' ? 0 : 1] ?? '',
  };
}
