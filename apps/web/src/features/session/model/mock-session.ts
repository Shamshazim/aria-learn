import type { Band } from '@aria/shared';

export type MockStep = Readonly<{
  prompt: string;
  choices: readonly string[];
  answer: string;
  hint: string;
}>;

export type MockSession = Readonly<{
  band: Band;
  subject: string;
  steps: readonly MockStep[];
}>;

const STEPS: readonly MockStep[] = [
  {
    prompt: 'What is 4 plus 3?',
    choices: ['6', '7', '8'],
    answer: '7',
    hint: 'Start at 4 and count on three more.',
  },
  {
    prompt: 'Which shape has three sides?',
    choices: ['Circle', 'Triangle', 'Square'],
    answer: 'Triangle',
    hint: 'Count the straight sides.',
  },
  {
    prompt: 'What comes next: 5, 10, 15, …?',
    choices: ['16', '20', '25'],
    answer: '20',
    hint: 'The pattern adds five each time.',
  },
];

export function mockSession(band: Band, subject: string): MockSession {
  return { band, subject, steps: STEPS };
}
