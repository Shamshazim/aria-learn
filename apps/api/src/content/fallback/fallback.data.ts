import type { ContentKind, JsonValue } from '@/content/types';
import type { GateInput } from '@/quality';

export type FallbackDefinition = Readonly<{
  skillCode: string;
  kind: ContentKind;
  gateInput: GateInput;
  body: JsonValue;
}>;

const reviewedText = (
  skillCode: string,
  band: GateInput['band'],
  childText: string,
  kind: ContentKind,
): FallbackDefinition => ({
  skillCode,
  kind,
  gateInput: {
    id: `fallback-${skillCode.toLowerCase().replaceAll('.', '-')}`,
    kind: 'text',
    band,
    childText,
    factual: false,
    grounding: 'reviewed-bank',
  },
  body: { prompt: childText, completionOnly: true },
});

export const FALLBACK_CONTENT: readonly FallbackDefinition[] = [
  {
    skillCode: 'NUM.CNT.20',
    kind: 'question',
    gateInput: {
      id: 'fallback-num-cnt-20',
      kind: 'multiple-choice',
      band: 'early',
      childText: '17, 18, 19. What is next?',
      factual: true,
      grounding: 'reviewed-bank',
      answerKey: 'b',
      options: [
        { id: 'a', text: '19', isCorrect: false },
        { id: 'b', text: '20', isCorrect: true },
        { id: 'c', text: '21', isCorrect: false },
      ],
      arithmeticProblem: {
        skillCode: 'NUM.CNT.20',
        kind: 'sequence',
        values: ['17', '18', '19'],
        step: '1',
      },
    },
    body: {
      prompt: '17, 18, 19. What is next?',
      choices: ['19', '20', '21'],
      answerKey: '20',
      arithmeticProblem: {
        skillCode: 'NUM.CNT.20',
        kind: 'sequence',
        values: ['17', '18', '19'],
        step: '1',
      },
    },
  },
  {
    skillCode: 'NUM.CNT.SKIP5',
    kind: 'question',
    gateInput: {
      id: 'fallback-num-cnt-skip5',
      kind: 'multiple-choice',
      band: 'early',
      childText: '5, 10, 15. What is next?',
      factual: true,
      grounding: 'reviewed-bank',
      answerKey: 'b',
      options: [
        { id: 'a', text: '16', isCorrect: false },
        { id: 'b', text: '20', isCorrect: true },
        { id: 'c', text: '25', isCorrect: false },
      ],
      arithmeticProblem: {
        skillCode: 'NUM.CNT.SKIP5',
        kind: 'sequence',
        values: ['5', '10', '15'],
        step: '5',
      },
    },
    body: {
      prompt: '5, 10, 15. What is next?',
      choices: ['16', '20', '25'],
      answerKey: '20',
      arithmeticProblem: {
        skillCode: 'NUM.CNT.SKIP5',
        kind: 'sequence',
        values: ['5', '10', '15'],
        step: '5',
      },
    },
  },
  {
    skillCode: 'ADD.FACT.10',
    kind: 'question',
    gateInput: {
      id: 'fallback-add-fact-10',
      kind: 'multiple-choice',
      band: 'early',
      childText: 'What is seven add three?',
      factual: true,
      grounding: 'reviewed-bank',
      answerKey: 'b',
      options: [
        { id: 'a', text: '9', isCorrect: false },
        { id: 'b', text: '10', isCorrect: true },
        { id: 'c', text: '11', isCorrect: false },
      ],
      arithmeticProblem: { skillCode: 'ADD.FACT.10', kind: 'addition', left: '7', right: '3' },
    },
    body: {
      prompt: 'What is seven add three?',
      choices: ['9', '10', '11'],
      answerKey: '10',
      arithmeticProblem: { skillCode: 'ADD.FACT.10', kind: 'addition', left: '7', right: '3' },
    },
  },
  {
    skillCode: 'ADD.REGROUP.2D',
    kind: 'question',
    gateInput: {
      id: 'fallback-add-regroup-2d',
      kind: 'multiple-choice',
      band: 'middle',
      childText: 'What is 48 add 37?',
      factual: true,
      grounding: 'reviewed-bank',
      answerKey: 'b',
      options: [
        { id: 'a', text: '75', isCorrect: false },
        { id: 'b', text: '85', isCorrect: true },
        { id: 'c', text: '95', isCorrect: false },
      ],
      arithmeticProblem: {
        skillCode: 'ADD.REGROUP.2D',
        kind: 'addition',
        left: '48',
        right: '37',
      },
    },
    body: {
      prompt: 'What is 48 add 37?',
      choices: ['75', '85', '95'],
      answerKey: '85',
      arithmeticProblem: { skillCode: 'ADD.REGROUP.2D', kind: 'addition', left: '48', right: '37' },
    },
  },
  {
    skillCode: 'FRAC.EQUAL',
    kind: 'question',
    gateInput: {
      id: 'fallback-frac-equal',
      kind: 'multiple-choice',
      band: 'early',
      childText: 'Are one and one equal?',
      factual: true,
      grounding: 'reviewed-bank',
      answerKey: 'a',
      options: [
        { id: 'a', text: 'equal', isCorrect: true },
        { id: 'b', text: 'not equal', isCorrect: false },
      ],
      arithmeticProblem: {
        skillCode: 'FRAC.EQUAL',
        kind: 'fraction-equality',
        left: '1/2',
        right: '2/4',
      },
    },
    body: {
      prompt: 'Are 1/2 and 2/4 equal?',
      choices: ['equal', 'not equal'],
      answerKey: 'equal',
      arithmeticProblem: {
        skillCode: 'FRAC.EQUAL',
        kind: 'fraction-equality',
        left: '1/2',
        right: '2/4',
      },
    },
  },
  {
    skillCode: 'FRAC.COMPARE',
    kind: 'question',
    gateInput: {
      id: 'fallback-frac-compare',
      kind: 'multiple-choice',
      band: 'middle',
      childText: 'Which is more?',
      factual: true,
      grounding: 'reviewed-bank',
      answerKey: 'a',
      options: [
        { id: 'a', text: '>', isCorrect: true },
        { id: 'b', text: '=', isCorrect: false },
        { id: 'c', text: '<', isCorrect: false },
      ],
      arithmeticProblem: {
        skillCode: 'FRAC.COMPARE',
        kind: 'fraction-comparison',
        left: '5/8',
        right: '3/8',
      },
    },
    body: {
      prompt: 'Compare 5/8 and 3/8.',
      choices: ['>', '=', '<'],
      answerKey: '>',
      arithmeticProblem: {
        skillCode: 'FRAC.COMPARE',
        kind: 'fraction-comparison',
        left: '5/8',
        right: '3/8',
      },
    },
  },
  reviewedText('PA.RHYME', 'early', 'Pick cat and hat.', 'activity'),
  reviewedText('PA.BLEND', 'early', 'Say cat.', 'activity'),
  reviewedText('PH.CVC', 'early', 'Read cat.', 'activity'),
  {
    ...reviewedText('PH.SILENT_E', 'early', 'Read make.', 'activity'),
    body: { prompt: 'Read make.', answerKey: 'make' },
  },
  reviewedText('FL.WCPM.60', 'early', 'Read the cat and the dog.', 'passage'),
  reviewedText('CMP.RETELL', 'early', 'What did the cat do?', 'activity'),
  reviewedText('WR.WORD', 'early', 'Write one word.', 'writing-prompt'),
  reviewedText('WR.SENTENCE', 'early', 'Write one sentence.', 'writing-prompt'),
  reviewedText('WR.PARAGRAPH', 'middle', 'Write one paragraph.', 'writing-prompt'),
  reviewedText(
    'WR.SHORT_PIECE',
    'senior',
    'Write a short piece with a beginning and an end.',
    'writing-prompt',
  ),
];
