import type { Band } from '@aria/shared';

import type { QualityGate } from '@/quality';
import type { ArithmeticProblem } from '@/quality/arithmetic';

export type WordProblemVerdict =
  | Readonly<{ accepted: true; prompt: string }>
  | Readonly<{
      accepted: false;
      reason: 'numbers-changed' | 'numbers-missing' | 'empty' | 'gate-failed';
      /** The gate's own codes when it was the gate that refused. */
      codes?: readonly string[];
    }>;

export type WordProblemInput = Readonly<{
  problem: ArithmeticProblem;
  /** What the model wrote around the item. */
  wrapper: string;
  band: Band;
  gate: QualityGate;
}>;

/**
 * The gate on a model-written story wrapper (P2H-10).
 *
 * A model may phrase an item as a word problem for the older bands. It may not change the
 * maths, and the failure mode is silent: a wrapper that turns "48 add 37" into "she had 47
 * marbles" produces an item whose answer key is now wrong and whose checker never sees the
 * discrepancy, because the checker grades the problem and the child reads the prose.
 *
 * So the numbers are pinned first, and then the wrapper faces the same quality gate every
 * other child-facing sentence does — structural, reading level, safety. Pinning first is
 * deliberate: a wrapper that changed a number should be reported as having changed a number,
 * not as having failed a readability check it also happens to fail.
 */
export function acceptWordProblem(input: WordProblemInput): WordProblemVerdict {
  const text = input.wrapper.trim();
  if (text === '') return { accepted: false, reason: 'empty' };
  const pinned = numbersPinned(input.problem, text);
  if (pinned !== null) return pinned;
  const verdict = input.gate({
    id: `word-problem-${input.problem.skillCode}`,
    kind: 'text',
    band: input.band,
    childText: text,
    factual: true,
    grounding: 'approved-source',
  });
  return verdict.verdict === 'pass'
    ? { accepted: true, prompt: text }
    : {
        accepted: false,
        reason: 'gate-failed',
        codes: verdict.reasons.map((failure) => failure.code),
      };
}

/** `null` when every number survived; the refusal otherwise. */
function numbersPinned(problem: ArithmeticProblem, text: string): WordProblemVerdict | null {
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
  return null;
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
