import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';

/**
 * Which digit is in the tens or the ones place of a two-digit number (1.NBT.B.2).
 *
 * Both places are asked, so "the first digit" is never a rule that works; numbers whose two
 * digits match (44) are left out, because they cannot tell a child who knows the places from
 * one who does not.
 */
type Point = readonly [number: number, place: 'tens' | 'ones'];

const POINTS: readonly Point[] = Array.from({ length: 90 }, (_u, index) => index + 10)
  .filter((number) => Math.floor(number / 10) !== number % 10)
  .flatMap((number): Point[] => [
    [number, 'tens'],
    [number, 'ones'],
  ]);

export const NUM_PV_TENS_PARAMS: GeneratorParams = {
  skillCode: 'NUM.PV.TENS',
  size: POINTS.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const point = POINTS[index];
  if (point === undefined) return null;
  const [number, place] = point;
  return {
    problem: { skillCode: 'NUM.PV.TENS', kind: 'place-value', number: String(number), place },
    answer: String(place === 'tens' ? Math.floor(number / 10) : number % 10),
  };
}
