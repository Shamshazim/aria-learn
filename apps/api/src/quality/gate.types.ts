import type { Band } from '@aria/shared';

import type { ArithmeticProblem } from '@/quality/arithmetic';

export type GateCheckName = 'structural' | 'correctness' | 'level' | 'safety';
export type Grounding = 'approved-source' | 'reviewed-bank' | 'unsupported';

export type GateOption = Readonly<{
  id: string;
  text: string;
  isCorrect: boolean;
}>;

type GateInputBase = Readonly<{
  id: string;
  band: Band;
  childText: string;
  factual: boolean;
  grounding: Grounding;
}>;

export type GateInput =
  | (GateInputBase & Readonly<{ kind: 'text' }>)
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
