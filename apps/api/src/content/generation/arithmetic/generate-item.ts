import { createHash } from 'node:crypto';

import type { Band } from '@aria/shared';

import { buildDistractors } from '@/content/generation/arithmetic/distractors';
import { SKILL_PARAMS } from '@/content/generation/arithmetic/params';
import { phraseItem } from '@/content/generation/arithmetic/phrasing';
import type { GeneratedItem } from '@/content/generation/arithmetic/types';
import { checkArithmetic, type ArithmeticSkillCode } from '@/quality/arithmetic';

/** Three options where the answer space allows it: enough to mean something, few enough to hear. */
const MAX_DISTRACTORS = 2;
/**
 * One wrong option is the floor.
 *
 * A yes-or-no item — "are 1/2 and 2/4 equal?" — has exactly one wrong answer, and refusing it
 * for having too few options would delete a whole skill from the bank.
 */
const MIN_DISTRACTORS = 1;

export type GenerateInput = Readonly<{
  skillCode: ArithmeticSkillCode;
  band: Band;
  /** Which point of the skill's parameter space to build. Deterministic: same index, same item. */
  index: number;
}>;

/**
 * Builds one practice item, or refuses (P2H-10).
 *
 * `null` is a real answer and has two causes, both of which the caller handles the same way by
 * moving on: the parameter space ran out, or the checker would not prove the key. The second
 * is the important one. An item the checker cannot solve is never shipped with a key the
 * generator merely believes — that is how a wrong answer becomes a wrong lesson.
 */
export function generateItem(input: GenerateInput): GeneratedItem | null {
  const candidate = SKILL_PARAMS[input.skillCode].at(input.index);
  if (candidate === null) return null;
  if (checkArithmetic(candidate.problem, candidate.answer).verdict !== 'correct') return null;
  const distractors = buildDistractors({
    problem: candidate.problem,
    answer: candidate.answer,
    count: MAX_DISTRACTORS,
  });
  if (distractors.length < MIN_DISTRACTORS) return null;
  const prompt = phraseItem(candidate.problem, input.band);
  const options = [{ text: candidate.answer, misconceptionId: null }, ...distractors];
  const ordered = orderOptions(options, `${prompt}|${candidate.answer}`);
  return {
    skillCode: input.skillCode,
    band: input.band,
    prompt,
    choices: ordered.map((option) => option.text),
    answerKey: candidate.answer,
    arithmeticProblem: candidate.problem,
    distractorMisconceptions: ordered.map((option) => option.misconceptionId),
    contentHash: hash(`${input.skillCode}|${input.band}|${prompt}|${candidate.answer}`),
  };
}

/** How many items this skill can produce before it starts repeating itself. */
export function parameterSpaceSize(skillCode: ArithmeticSkillCode): number {
  return SKILL_PARAMS[skillCode].size;
}

/**
 * Puts the answer somewhere other than first, without calling a random number generator.
 *
 * The position is a function of the item, so the same item always looks the same — a child who
 * meets it twice is not told it is the same item by the answer having moved, and a test does
 * not have to inject a seed to know what it will get.
 */
function orderOptions<T>(options: readonly T[], seed: string): readonly T[] {
  // A whole word of the digest, not one hex character of it: sixteen hex values do not divide
  // evenly by three, and a bank where the answer is first 38% of the time is a bank a child can
  // beat by always tapping first.
  const rotation = digest(seed).readUInt32BE(0) % options.length;
  return [...options.slice(rotation), ...options.slice(0, rotation)];
}

function hash(value: string): string {
  return digest(value).toString('hex');
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}
