import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';

/**
 * Jumps of five, shown as three or four of them.
 *
 * The space is deliberately small — seven starting points, two lengths. A skill whose whole
 * parameter space is fourteen items is the one that proves the exhaustion path works, and
 * counting by five within fifty genuinely has no more to offer.
 */
const STARTS = 7;
const LENGTHS = [3, 4] as const;

export const NUM_CNT_SKIP5_PARAMS: GeneratorParams = {
  skillCode: 'NUM.CNT.SKIP5',
  size: STARTS * LENGTHS.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const length = LENGTHS[index % LENGTHS.length];
  const start = 5 * (Math.floor(index / LENGTHS.length) + 1);
  if (length === undefined || start > 5 * STARTS) return null;
  const values = Array.from({ length }, (_unused, step) => String(start + 5 * step));
  return {
    problem: { skillCode: 'NUM.CNT.SKIP5', kind: 'sequence', values, step: '5' },
    answer: String(start + 5 * length),
  };
}
