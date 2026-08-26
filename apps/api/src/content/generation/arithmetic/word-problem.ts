import type { ArithmeticProblem } from '@/quality/arithmetic';

export type WordProblemVerdict =
  | Readonly<{ accepted: true; prompt: string }>
  | Readonly<{ accepted: false; reason: 'numbers-changed' | 'numbers-missing' | 'empty' }>;

/**
 * The gate on a model-written story wrapper (P2H-10).
 *
 * A model may phrase an item as a word problem for the older bands. It may not change the
 * maths, and the failure mode is silent: a wrapper that turns "48 add 37" into "she had 47
 * marbles" produces an item whose answer key is now wrong and whose checker never sees the
 * discrepancy, because the checker grades the problem and the child reads the prose.
 *
 * So the numbers are pinned. Every number in the structured problem must appear in the
 * wrapper, and the wrapper may introduce none of its own.
 */
export function acceptWordProblem(problem: ArithmeticProblem, wrapper: string): WordProblemVerdict {
  const text = wrapper.trim();
  if (text === '') return { accepted: false, reason: 'empty' };
  const required = numbersIn(problemText(problem));
  const found = numbersIn(text);
  // A number the problem does not have is reported first: a substitution shows up as both a
  // foreign number and a missing one, and "changed" is the more useful of the two to be told.
  for (const value of found) {
    if (!required.includes(value)) return { accepted: false, reason: 'numbers-changed' };
  }
  for (const value of required) {
    if (!found.includes(value)) return { accepted: false, reason: 'numbers-missing' };
  }
  return { accepted: true, prompt: text };
}

/** Every number the problem is made of, as written. */
function problemText(problem: ArithmeticProblem): string {
  switch (problem.kind) {
    case 'sequence':
      return [...problem.values, problem.step].join(' ');
    case 'addition':
    case 'fraction-equality':
    case 'fraction-comparison':
      return `${problem.left} ${problem.right}`;
  }
}

/**
 * Numbers as digit runs, so `1/2` contributes a one and a two.
 *
 * That is stricter than reading it as a fraction on purpose: a wrapper that says "one half"
 * has dropped the digits a child would need to answer, and stricter here costs a retry
 * whereas looser costs a wrong answer key.
 */
function numbersIn(text: string): readonly string[] {
  return [...text.matchAll(/\d+/gu)].map((match) => match[0]).sort();
}
