import { checkArithmetic, isArithmeticPass } from '@/quality/arithmetic';
import { failed, passed } from '@/quality/checks/check-result';
import type { GateCheckResult, GateInput } from '@/quality/gate.types';

export function checkCorrectness(input: GateInput): GateCheckResult {
  if (input.kind === 'multiple-choice' && input.arithmeticProblem !== undefined) {
    const candidate = input.options.find((option) => option.id === input.answerKey)?.text;
    if (candidate === undefined) {
      return failed('correctness', 'missing_candidate', 'Arithmetic answer key has no candidate.');
    }
    const result = checkArithmetic(input.arithmeticProblem, candidate);
    return isArithmeticPass(result)
      ? passed('correctness')
      : failed('correctness', `arithmetic_${result.verdict}`, result.reason);
  }

  if (input.factual && input.grounding === 'unsupported') {
    return failed(
      'correctness',
      'unsupported_fact',
      'Factual content must cite an approved source or reviewed bank.',
    );
  }
  return passed('correctness');
}
