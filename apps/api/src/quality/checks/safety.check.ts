import { failed, passed } from '@/quality/checks/check-result';
import { childFacingText } from '@/quality/checks/content-text';
import type { GateCheckResult, GateInput, SafetyChecker } from '@/quality/gate.types';

export function checkSafety(input: GateInput, checker: SafetyChecker): GateCheckResult {
  const assessment = checker(childFacingText(input));
  return assessment.safe
    ? passed('safety')
    : failed(
        'safety',
        'unsafe_content',
        `Safety classifier flagged: ${assessment.categories.join(', ') || 'unspecified'}.`,
      );
}
