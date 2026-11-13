import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';

/**
 * Which digit is in the hundreds or the tens place of a three-digit number (2.NBT.A.1).
 *
 * Every seventh number from 101, so the bank covers the range without three hundred near-copies;
 * a number with a repeated digit in the places asked about is skipped for the same reason as
 * in `num-pv-tens.ts`.
 */
type Point = readonly [number: number, place: 'hundreds' | 'tens'];

const digit = (number: number, place: number): number => Math.floor(number / place) % 10;

const POINTS: readonly Point[] = Array.from({ length: 128 }, (_u, index) => 101 + index * 7)
  .filter(
    (number) => digit(number, 100) !== digit(number, 10) && digit(number, 10) !== digit(number, 1),
  )
  .flatMap((number): Point[] => [
    [number, 'hundreds'],
    [number, 'tens'],
  ]);

export const NUM_PV_HUNDREDS_PARAMS: GeneratorParams = {
  skillCode: 'NUM.PV.HUNDREDS',
  size: POINTS.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const point = POINTS[index];
  if (point === undefined) return null;
  const [number, place] = point;
  return {
    problem: { skillCode: 'NUM.PV.HUNDREDS', kind: 'place-value', number: String(number), place },
    answer: String(digit(number, place === 'hundreds' ? 100 : 10)),
  };
}
