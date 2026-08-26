import type { Band } from '@aria/shared';

import type { ArithmeticProblem, ArithmeticSkillCode } from '@/quality/arithmetic';

/**
 * One point in a skill's parameter space, before the checker has seen it (P2H-10).
 *
 * The generator proposes the answer; it is not believed until `checkArithmetic` solves the
 * problem independently and agrees. That is the whole reason the answer travels with the
 * problem instead of being read off the model that phrased it.
 */
export type CandidateItem = Readonly<{
  problem: ArithmeticProblem;
  answer: string;
}>;

export type GeneratorParams = Readonly<{
  skillCode: ArithmeticSkillCode;
  /** How many points the space has. Asking beyond it is how "no new item" is reported. */
  size: number;
  at(index: number): CandidateItem | null;
}>;

/** A finished, checker-proven practice item. */
export type GeneratedItem = Readonly<{
  skillCode: ArithmeticSkillCode;
  band: Band;
  prompt: string;
  choices: readonly string[];
  answerKey: string;
  arithmeticProblem: ArithmeticProblem;
  /** Which misconception each wrong option offers, in the same order as `choices`. */
  distractorMisconceptions: readonly (string | null)[];
  /** Identifies the item's content, so re-running the generator cannot store it twice. */
  contentHash: string;
}>;
