import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';

/**
 * Runs of consecutive numbers, asking for the next one, anywhere inside twenty.
 *
 * The run length varies as well as the start. Two numbers is a harder question than four —
 * there is less pattern to lean on — so varying it is difficulty, not decoration, and it is
 * also what takes this skill's bank past the pre-warm target.
 */
const LAST = 20;
const LENGTHS = [2, 3, 4] as const;

const RUNS: readonly (readonly number[])[] = LENGTHS.flatMap((length) =>
  Array.from({ length: LAST - length }, (_unused, index) =>
    Array.from({ length }, (_step, offset) => index + 1 + offset),
  ),
);

export const NUM_CNT_20_PARAMS: GeneratorParams = {
  skillCode: 'NUM.CNT.20',
  size: RUNS.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const run = RUNS[index];
  const last = run?.at(-1);
  if (run === undefined || last === undefined) return null;
  return {
    problem: {
      skillCode: 'NUM.CNT.20',
      kind: 'sequence',
      values: run.map(String),
      step: '1',
    },
    answer: String(last + 1),
  };
}
