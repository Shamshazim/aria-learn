import { generateItem } from '@/content/generation/arithmetic';
import type { ArithmeticSkillCode } from '@/quality/arithmetic';
import type { GoldenSource } from '@/testing/golden/types';

/**
 * The golden source for deterministically generated items (P2H-10).
 *
 * It runs no model and costs nothing, and it is still worth grading: the generator hands the
 * harness its own answer, and every check that follows — the independent arithmetic solve, the
 * single-correct-option rule, the readability bar for the band — is applied to it exactly as
 * it would be to a model's. A generator that quietly starts producing an unreadable prompt or
 * two correct options fails here rather than in front of a child.
 */
export function createGeneratorGoldenSource(
  dependencies: Readonly<{ now: () => number }>,
): GoldenSource {
  return {
    // Deferred rather than thrown straight out: the port is declared to return a promise, and
    // a caller that only guards `.catch` should not be the one to find that out.
    generate: (item) =>
      Promise.resolve().then(() => {
        const started = dependencies.now();
        const index = item.generatorIndex;
        if (index === undefined) throw new Error(`Golden case ${item.id} has no generator index`);
        const generated = generateItem({
          skillCode: skillCodeOf(item.skillCode, item.id),
          band: item.band,
          index,
        });
        if (generated === null) throw new Error(`Generator refused golden case ${item.id}`);
        return {
          prompt: generated.prompt,
          answer: generated.answerKey,
          options: generated.choices.map((text, position) => ({ id: String(position), text })),
          answerKey: String(generated.choices.indexOf(generated.answerKey)),
          endpointName: 'generator',
          model: 'deterministic',
          latencyMs: dependencies.now() - started,
          costUsd: 0,
        };
      }),
  };
}

const CODES: Readonly<Record<ArithmeticSkillCode, true>> = {
  'NUM.CNT.20': true,
  'NUM.CNT.SKIP5': true,
  'ADD.FACT.10': true,
  'ADD.REGROUP.2D': true,
  'FRAC.EQUAL': true,
  'FRAC.COMPARE': true,
};

function skillCodeOf(code: string, itemId: string): ArithmeticSkillCode {
  if (!isSkillCode(code))
    throw new Error(`Golden case ${itemId} names ${code}, which has no generator`);
  return code;
}

function isSkillCode(code: string): code is ArithmeticSkillCode {
  return Object.hasOwn(CODES, code);
}
