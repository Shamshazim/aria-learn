/**
 * What a reveal owes a child (P2H-11).
 *
 * §4.1: a reveal shows the answer *with the reasoning*. Both halves are checkable, so both are
 * in the table. `idea` is the matched misconception's name, present only where one matched.
 */
export type RevealCase = Readonly<{
  name: string;
  text: string;
  answer: string;
  idea: string | null;
  verdict: 'pass' | 'fail';
  code?: string;
}>;

export const REVEAL_CASES: readonly RevealCase[] = [
  {
    name: 'says the answer and why',
    text: 'The answer is 42. Ten more than thirty-two is forty-two, because only the tens change.',
    answer: '42',
    idea: null,
    verdict: 'pass',
  },
  {
    name: 'names the idea behind the mistake without calling it wrong',
    text: 'The answer is 1/2. Halves are bigger pieces than quarters, so the pieces have to be the same size before you compare.',
    answer: '1/2',
    idea: 'compares fractions by the size of the bottom number',
    verdict: 'pass',
  },
  {
    name: 'never gets round to the answer',
    text: 'This one is about place value. Have a think about the tens column and try again.',
    answer: '42',
    idea: null,
    verdict: 'fail',
    code: 'missing_answer',
  },
  {
    name: 'states the answer and stops',
    text: 'The answer is 42.',
    answer: '42',
    idea: null,
    verdict: 'fail',
    code: 'missing_reasoning',
  },
  {
    name: 'ignores the idea the child actually had',
    text: 'The answer is 1/2. That is the one that is bigger here.',
    answer: '1/2',
    idea: 'compares fractions by the size of the bottom number',
    verdict: 'fail',
    code: 'missing_idea',
  },
];
