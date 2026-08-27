import type { Misconception } from '@aria/shared';

import type { ArithmeticProblem } from '@/quality/arithmetic';

/**
 * How a wrong idea is recognised in a child's answer (P2H-10).
 *
 * `Misconception.signature` stays the sentence a teacher reads. This is the machine half: a
 * declarative rule the matcher evaluates, so the data files stay data and the one module that
 * knows how to evaluate a rule stays testable on its own.
 *
 * Deriving distractors from these is the point. A wrong option that is nothing but a plausible
 * number tells us the child was wrong; a wrong option built from a signature tells us *which*
 * wrong idea they had, and that is what a `RETEACH` needs.
 */
export type MisconceptionSignature =
  /** The answer, normalised, is one of these literals. */
  | Readonly<{ kind: 'exact'; answers: readonly string[] }>
  /** The answer matches this pattern. Source only; the matcher supplies the flags. */
  | Readonly<{ kind: 'pattern'; pattern: string }>
  /** The numeric answer is the key plus this much. */
  | Readonly<{ kind: 'off-by'; delta: number }>
  /** The answer is the key with this ending removed, such as `cape` read as `cap`. */
  | Readonly<{ kind: 'key-without-suffix'; suffix: string }>
  /** The answer is the key with this ending added, such as `bed` read as `bede`. */
  | Readonly<{ kind: 'key-with-suffix'; suffix: string }>
  /** The answer starts like the key but is not the key: a guess from the first sounds. */
  | Readonly<{ kind: 'shares-key-prefix'; length: number }>
  /**
   * The answer starts like the last word of the question rather than like the key.
   *
   * Rhyme needs this and nothing else does: the wrong idea is matching the *prompt* word's
   * opening sound, so the key is the wrong thing to compare against.
   */
  | Readonly<{ kind: 'shares-question-prefix'; length: number }>
  /** The answer is exactly what this named rule computes from the problem or the key. */
  | Readonly<{ kind: 'derived'; rule: DerivedRule }>;

/** Rules computed from the structured arithmetic problem the item carries. */
export type ArithmeticRule =
  | 'place-independent-sum'
  | 'dropped-carry'
  | 'carried-ones-digit'
  | 'names-an-operand'
  | 'subtracted-instead'
  | 'counted-by-one'
  | 'restarted-count'
  | 'repeats-last'
  | 'larger-denominator-wins'
  | 'reversed-comparison'
  | 'says-unequal-for-equivalent'
  | 'says-equal-for-same-numerator'
  | 'says-equal-for-same-denominator';

/** Rules computed from the answer key or the question, for reading and writing. */
export type TextRule =
  'echoes-the-question' | 'drops-middle-letter' | 'swapped-vowel' | 'shorter-than-key';

export type DerivedRule = ArithmeticRule | TextRule;

export type MisconceptionInput = Readonly<{
  skillCode: string | null;
  question: string | null;
  expectedAnswer: string | null;
  learnerAnswer: string;
  /** Present when the item carried one; the arithmetic rules are undecidable without it. */
  problem: ArithmeticProblem | null;
}>;

/** The inventory entry plus the rule that recognises it. */
export type AuthoredMisconception = Misconception & Readonly<{ detects: MisconceptionSignature }>;
