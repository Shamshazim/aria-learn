import type { Band } from '@aria/shared';

/**
 * The readability gate's regression corpus (P2H-02).
 *
 * `pass` entries are sentences a warm human tutor would actually say to a child in that band;
 * the old vocabulary whitelist rejected most of them, which is why children heard static
 * fallbacks. `fail` entries are the wrong-level and wrong-tone text the whitelist did catch —
 * they must keep failing, and each names the code it must fail with, so a threshold change
 * that quietly waves them through breaks the build instead of reaching a child.
 */
export type LevelCase = Readonly<{
  name: string;
  band: Band;
  text: string;
  expect: 'pass' | 'fail';
  /** The code the rejection must carry. Only meaningful when `expect` is `fail`. */
  code?: string;
}>;

export const LEVEL_CORPUS: readonly LevelCase[] = [
  // Early band — must pass.
  {
    name: 'early encouragement with a name',
    band: 'early',
    expect: 'pass',
    text: "Let's try it together, Sam! You've got this.",
  },
  {
    name: 'early specific praise',
    band: 'early',
    expect: 'pass',
    text: 'Yes! You counted on from four.',
  },
  { name: 'early hint', band: 'early', expect: 'pass', text: 'Start at six. Count up two more.' },
  {
    name: 'early re-ask',
    band: 'early',
    expect: 'pass',
    text: 'No rush. What do you think comes next?',
  },
  {
    name: 'early check-in',
    band: 'early',
    expect: 'pass',
    text: 'Are you still there? Tap or say something.',
  },
  {
    name: 'early reteach with a model',
    band: 'early',
    expect: 'pass',
    text: 'Look at the ten frame. Fill it up first.',
  },
  {
    name: 'early welcome',
    band: 'early',
    expect: 'pass',
    text: 'Hi again! I am glad you came back today.',
  },
  {
    name: 'early reveal',
    band: 'early',
    expect: 'pass',
    text: 'The answer is seven. Four and three make seven.',
  },
  {
    name: 'early goodbye',
    band: 'early',
    expect: 'pass',
    text: 'That was good work. See you next time!',
  },
  { name: 'early question', band: 'early', expect: 'pass', text: 'What is four plus three?' },
  // Middle band — must pass.
  {
    name: 'middle reasoning aloud',
    band: 'middle',
    expect: 'pass',
    text: 'First line up the tens, because each column has to hold the same place value.',
  },
  {
    name: 'middle invitation to guess',
    band: 'middle',
    expect: 'pass',
    text: 'Before we work it out, what do you think the answer is close to?',
  },
  {
    name: 'middle praise',
    band: 'middle',
    expect: 'pass',
    text: 'You regrouped the tens before you added, and that is exactly the hard part.',
  },
  {
    name: 'middle reteach',
    band: 'middle',
    expect: 'pass',
    text: 'Think of the fraction as pieces of one whole. The pieces have to be the same size.',
  },
  {
    name: 'middle answer to a question',
    band: 'middle',
    expect: 'pass',
    text: 'Good thing to ask. A remainder is what is left over when the groups are equal.',
  },
  {
    name: 'middle end',
    band: 'middle',
    expect: 'pass',
    text: 'Today you worked on regrouping, and you kept going after a hard one.',
  },
  // Senior band — must pass.
  {
    name: 'senior push back',
    band: 'senior',
    expect: 'pass',
    text: 'That works for this case. Why does it work when the denominator changes?',
  },
  {
    name: 'senior explanation',
    band: 'senior',
    expect: 'pass',
    text: 'An equivalent fraction keeps the same value because you multiply the top and the bottom by the same number.',
  },
  {
    name: 'senior calm reveal',
    band: 'senior',
    expect: 'pass',
    text: 'The answer is three quarters. The two fractions share a denominator once you scale the first one.',
  },
  {
    name: 'senior end',
    band: 'senior',
    expect: 'pass',
    text: 'You defended your reasoning today instead of guessing. That is the part that carries over.',
  },
  // Regressions — these were caught before and must keep failing.
  {
    name: 'three-clause grade one sentence',
    band: 'early',
    expect: 'fail',
    code: 'sentence_too_long',
    text: 'When you have finished counting the blocks that are on the table, and you are sure about the number, tell me what you found.',
  },
  {
    name: 'fifteen-word early sentence',
    band: 'early',
    expect: 'fail',
    code: 'sentence_too_long',
    text: 'We are going to look at the numbers on this line and find the difference.',
  },
  {
    name: 'academic register for a five year old',
    band: 'early',
    expect: 'fail',
    code: 'readability',
    text: 'Interpret the relationship between the quantities and justify your conclusion.',
  },
  {
    name: 'senior vocabulary in the early band',
    band: 'early',
    expect: 'fail',
    code: 'readability',
    text: 'Consider the equivalent representation before evaluating the numerator carefully.',
  },
  {
    name: 'run-on for the middle band',
    band: 'middle',
    expect: 'fail',
    code: 'sentence_too_long',
    text: 'If you take the number that you started with and then you add the tens column first and after that you add the ones column you will get there.',
  },
  {
    name: 'undergraduate register in the middle band',
    band: 'middle',
    expect: 'fail',
    code: 'readability',
    text: 'The commutative property demonstrates that reordering the operands preserves the resulting evaluation entirely.',
  },
  {
    name: 'thesis sentence in the senior band',
    band: 'senior',
    expect: 'fail',
    code: 'sentence_too_long',
    text: 'Although the numerator and the denominator can both be multiplied by any non-zero integer without changing the value of the fraction, the representation you choose still matters for how quickly the comparison can be made by a reader.',
  },
  {
    name: 'insulting tone',
    band: 'middle',
    expect: 'fail',
    code: 'banned_word',
    text: 'That was a dumb mistake.',
  },
  {
    name: 'banned word inside a kind sentence',
    band: 'early',
    expect: 'fail',
    code: 'banned_word',
    text: 'Do not be silly, that idea is stupid.',
  },
];
