import type { FallbackDefinition } from '@/content/fallback/fallback.data';
import type { ArithmeticProblem } from '@/quality/arithmetic';

/**
 * Reviewed last-resort items for the P3-07 strands, one per skill, each proven by
 * the checker at boot like the rest of the bank. Kept beside the main bank rather than in it so
 * a strand's items are reviewed together and the bank file stays readable.
 */
export const ARITHMETIC_STRAND_FALLBACKS: readonly FallbackDefinition[] = [
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
  // P3-07, strand 2: addition and subtraction.
  item({
    skillCode: 'ADD.FACT.20',
    band: 'early',
    prompt: 'What is 8 add 5?',
    choices: ['10', '13', '3'],
    answer: '13',
    problem: { skillCode: 'ADD.FACT.20', kind: 'addition', left: '8', right: '5' },
  }),
  item({
    skillCode: 'SUB.FACT.10',
    band: 'early',
    prompt: 'What is seven take away three?',
    choices: ['10', '3', '4'],
    answer: '4',
    problem: { skillCode: 'SUB.FACT.10', kind: 'subtraction', left: '7', right: '3' },
  }),
  item({
    skillCode: 'SUB.REGROUP.2D',
    band: 'middle',
    prompt: 'What is 52 take away 18?',
    choices: ['34', '46', '44'],
    answer: '34',
    problem: { skillCode: 'SUB.REGROUP.2D', kind: 'subtraction', left: '52', right: '18' },
  }),
  item({
    skillCode: 'ADD.3D',
    band: 'middle',
    prompt: 'What is 158 add 267?',
    choices: ['315', '425', '325'],
    answer: '425',
    problem: { skillCode: 'ADD.3D', kind: 'addition', left: '158', right: '267' },
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
