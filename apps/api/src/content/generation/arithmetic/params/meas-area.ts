import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';

/**
 * Area and perimeter of a rectangle (3.MD.C.7, 3.MD.D.8): two different whole sides from 2 to
 * 12, asked for area and for perimeter in turn, so the two are always told apart.
 */
type Entry = readonly [number, number, 'area' | 'perimeter', string];

const UNITS = ['cm', 'm', 'in'] as const;

const ENTRIES: readonly Entry[] = Array.from({ length: 11 }, (_u, w) => w + 2).flatMap((width) =>
  Array.from({ length: 11 }, (_v, h) => h + 2)
    .filter((height) => height < width)
    .flatMap((height): Entry[] => [
      [width, height, 'area', UNITS[(width + height) % UNITS.length] ?? 'cm'],
      [width, height, 'perimeter', UNITS[(width * height) % UNITS.length] ?? 'cm'],
    ]),
);

export const MEAS_AREA_PARAMS: GeneratorParams = {
  skillCode: 'MEAS.AREA',
  size: ENTRIES.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const entry = ENTRIES[index];
  if (entry === undefined) return null;
  const [width, height, measure, unit] = entry;
  return {
    problem: {
      skillCode: 'MEAS.AREA',
      kind: 'rectangle',
      width: String(width),
      height: String(height),
      measure,
      unit,
    },
    answer: String(measure === 'area' ? width * height : 2 * (width + height)),
  };
}
