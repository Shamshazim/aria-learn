/**
 * Praise the gate must accept, and praise it must refuse (P2H-11).
 *
 * The table is the specification: `master-plan.md` §4.1 asks for praise that is specific and
 * not "good job", and the only way to hold a model to that is to write down what each looks
 * like. `allowed` is what the turn's evidence vouched for; `verdict` is what the gate owes us.
 */
export type PraiseCase = Readonly<{
  name: string;
  text: string;
  allowed: readonly string[];
  verdict: 'pass' | 'fail';
  code?: string;
}>;

export const PRAISE_CASES: readonly PraiseCase[] = [
  {
    name: 'names the strategy the grader vouched for',
    text: 'You regrouped when the ones went past ten. That is the step this one turns on.',
    allowed: ['regrouped'],
    verdict: 'pass',
  },
  {
    name: 'names a behaviour the attempt shows',
    text: 'You kept going after two hard ones. That is what got you here.',
    allowed: ['kept-going'],
    verdict: 'pass',
  },
  {
    name: 'says what was right without naming a method',
    text: 'That is the answer, and you had it straight off the question.',
    allowed: [],
    verdict: 'pass',
  },
  {
    name: 'invents a strategy nobody saw',
    text: 'You counted on from the bigger number. That was quick.',
    allowed: ['regrouped'],
    verdict: 'fail',
    code: 'ungrounded',
  },
  {
    name: 'invents a number line that was never on the screen',
    text: 'You used the number line to get there. Good thinking.',
    allowed: [],
    verdict: 'fail',
    code: 'ungrounded',
  },
  {
    name: 'claims the child checked work we never saw them check',
    text: 'You checked your work before you answered. That is the habit.',
    allowed: ['kept-going'],
    verdict: 'fail',
    code: 'ungrounded',
  },
  {
    name: 'says good job',
    text: 'Good job. That is right.',
    allowed: ['kept-going'],
    verdict: 'fail',
    code: 'empty_praise',
  },
  {
    name: 'says great job',
    text: 'Great job on that one.',
    allowed: [],
    verdict: 'fail',
    code: 'empty_praise',
  },
  {
    name: 'rates the child rather than the work',
    text: 'You are so smart. That is right.',
    allowed: [],
    verdict: 'fail',
    code: 'empty_praise',
  },
  {
    name: 'calls the child clever',
    text: 'Clever thinking there.',
    allowed: [],
    verdict: 'fail',
    code: 'empty_praise',
  },
];
