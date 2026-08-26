import type { Band } from '@aria/shared';

import type { ArithmeticProblem } from '@/quality/arithmetic';

export type GateCheckName = 'structural' | 'correctness' | 'claims' | 'level' | 'safety';
export type Grounding = 'approved-source' | 'reviewed-bank' | 'unsupported';

export type GateOption = Readonly<{
  id: string;
  text: string;
  isCorrect: boolean;
}>;

/**
 * What a move is allowed to say about what just happened (P2H-11).
 *
 * Supplied by the turn that is generating the text, never by the model: the whole point is
 * that the list comes from evidence. Omitted where a move makes no claims about the child.
 */
export type MoveClaims = Readonly<{
  /** Which move's own rules apply on top of the grounding check. */
  move: 'praise' | 'reveal' | 'end';
  /** Ids from `STRATEGY_CLAIMS` this turn actually saw the child do. Checked for praise only. */
  allowed: readonly string[];
  /** Things the move must get said, each with the failure it reports when it does not. */
  mustMention?: readonly MustMention[];
}>;

export type MustMention = Readonly<{
  code: string;
  message: string;
  /** Any one of these appearing in the text satisfies the requirement. */
  any: readonly string[];
}>;

type GateInputBase = Readonly<{
  id: string;
  band: Band;
  childText: string;
  factual: boolean;
  grounding: Grounding;
  /** P2H-11: present only for the moves that make claims about the child. */
  claims?: MoveClaims;
}>;

export type GateInput =
  | (GateInputBase & Readonly<{ kind: 'text' }>)
  /**
   * Decodable reading text (P4-02). It is deliberately *not* judged by the readability check:
   * decodable text is constrained by a phonics wordlist, not by a grade score, and a readability
   * score would either wave through the wrong pattern or reject a correct one. Until the
   * wordlist check exists, the gate refuses this kind outright (P2H-02).
   */
  | (GateInputBase & Readonly<{ kind: 'decodable'; pattern: 'cvc' }>)
  | (GateInputBase &
      Readonly<{
        kind: 'multiple-choice';
        options: readonly GateOption[];
        answerKey: string;
        arithmeticProblem?: ArithmeticProblem;
      }>);

export type GateFailureReason = Readonly<{
  check: GateCheckName;
  code: string;
  message: string;
}>;

export type GateCheckResult = Readonly<{
  check: GateCheckName;
  passed: boolean;
  reasons: readonly GateFailureReason[];
}>;

export const GATE_PASS_BRAND: unique symbol = Symbol('GatePass');
export type GatePass = Readonly<{ verdict: 'pass'; [GATE_PASS_BRAND]: true }>;

export type GateVerdict =
  | Readonly<{ verdict: 'pass'; pass: GatePass; checks: readonly GateCheckResult[] }>
  | Readonly<{
      verdict: 'fail';
      reasons: readonly GateFailureReason[];
      checks: readonly GateCheckResult[];
    }>;

export type SafetyAssessment = Readonly<{
  safe: boolean;
  categories: readonly string[];
}>;

export type SafetyChecker = (text: string) => SafetyAssessment;
