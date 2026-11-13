import type { FallbackDefinition } from '@/content/fallback/fallback.data';
import type { ArithmeticProblem } from '@/quality/arithmetic';

/**
 * Reviewed last-resort items for the number-sense strand (P3-07), one per skill, each proven by
 * the checker at boot like the rest of the bank. Kept beside the main bank rather than in it so
 * a strand's items are reviewed together and the bank file stays readable.
 */
export const NUMBER_SENSE_FALLBACKS: readonly FallbackDefinition[] = [
  item({
    skillCode: 'NUM.PV.TENS',
    band: 'early',
    prompt: 'Look at 47. Which digit is in the tens place?',
    choices: ['7', '4', '40'],
    answer: '4',
    problem: { skillCode: 'NUM.PV.TENS', kind: 'place-value', number: '47', place: 'tens' },
  }),
  item({
    skillCode: 'NUM.PV.HUNDREDS',
    band: 'early',
    prompt: 'Look at 352. Which digit is in the hundreds place?',
    choices: ['5', '3', '300'],
    answer: '3',
    problem: {
      skillCode: 'NUM.PV.HUNDREDS',
      kind: 'place-value',
      number: '352',
      place: 'hundreds',
    },
  }),
  item({
    skillCode: 'NUM.CMP.100',
    band: 'early',
    prompt: 'Is 29 more than, less than, or the same as 31?',
    choices: ['>', '<', '='],
    answer: '<',
    problem: { skillCode: 'NUM.CMP.100', kind: 'whole-comparison', left: '29', right: '31' },
  }),
  item({
    skillCode: 'NUM.RND.10',
    band: 'middle',
    prompt: 'Round 47 to the nearest ten.',
    choices: ['40', '50', '100'],
    answer: '50',
    problem: { skillCode: 'NUM.RND.10', kind: 'rounding', number: '47', to: '10' },
  }),
];

type Authored = Readonly<{
  skillCode: string;
  band: 'early' | 'middle';
  prompt: string;
  choices: readonly [string, string, string];
  answer: string;
  problem: ArithmeticProblem;
}>;

function item(input: Authored): FallbackDefinition {
  const ids = ['a', 'b', 'c'] as const;
  const answerIndex = input.choices.indexOf(input.answer);
  return {
    skillCode: input.skillCode,
    kind: 'question',
    gateInput: {
      id: `fallback-${input.skillCode.toLowerCase().replaceAll('.', '-')}`,
      kind: 'multiple-choice',
      band: input.band,
      childText: input.prompt,
      factual: true,
      grounding: 'reviewed-bank',
      answerKey: ids[answerIndex] ?? 'a',
      options: input.choices.map((text, index) => ({
        id: ids[index] ?? 'a',
        text,
        isCorrect: text === input.answer,
      })),
      arithmeticProblem: input.problem,
    },
    body: {
      prompt: input.prompt,
      choices: [...input.choices],
      answerKey: input.answer,
      arithmeticProblem: jsonOf(input.problem),
    },
  };
}

/** The bank stores plain JSON; these problems hold only strings, so that is all it needs. */
function jsonOf(problem: ArithmeticProblem): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(problem).flatMap(([key, value]) =>
      typeof value === 'string' ? [[key, value]] : [],
    ),
  );
}
