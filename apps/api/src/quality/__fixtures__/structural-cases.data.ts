import type { GateInput } from '@/quality';

const BASE: Extract<GateInput, { kind: 'multiple-choice' }> = {
  id: 'base-question',
  kind: 'multiple-choice',
  band: 'early',
  childText: 'What is seven add three?',
  factual: true,
  grounding: 'approved-source',
  answerKey: 'b',
  options: [
    { id: 'a', text: '9', isCorrect: false },
    { id: 'b', text: '10', isCorrect: true },
    { id: 'c', text: '11', isCorrect: false },
  ],
};

export type StructuralCase = Readonly<{
  name: string;
  input: GateInput;
  code: string;
}>;

export const STRUCTURAL_CASES: readonly StructuralCase[] = [
  {
    name: 'markup',
    input: { ...BASE, childText: 'What is seven add three?<br>' },
    code: 'markup',
  },
  {
    name: 'duplicate options',
    input: {
      ...BASE,
      options: BASE.options.map((option) =>
        option.id === 'c' ? { ...option, text: '10' } : option,
      ),
    },
    code: 'duplicate_options',
  },
  {
    name: 'two correct options',
    input: {
      ...BASE,
      options: BASE.options.map((option) =>
        option.id === 'a' ? { ...option, isCorrect: true } : option,
      ),
    },
    code: 'correct_option_count',
  },
  {
    name: 'missing key',
    input: { ...BASE, answerKey: 'z' },
    code: 'missing_answer_key',
  },
  {
    name: 'leaked correct marker',
    input: {
      ...BASE,
      options: BASE.options.map((option) =>
        option.id === 'b' ? { ...option, text: '10 (Correct)' } : option,
      ),
    },
    code: 'correct_marker',
  },
];

export const VALID_ARITHMETIC_ITEM: Extract<GateInput, { kind: 'multiple-choice' }> = {
  ...BASE,
  arithmeticProblem: { skillCode: 'ADD.FACT.10', kind: 'addition', left: '7', right: '3' },
};
