import { failedMany, passed } from '@/quality/checks/check-result';
import type { GateCheckResult, GateFailureReason, GateInput } from '@/quality/gate.types';

const MARKUP = /<\/?[a-z][^>]*>|&lt;\/?[a-z][^&]*&gt;/iu;
const CORRECT_MARKER = /\((?:correct|right answer|answer|true)\)|[✓✔☑]/iu;

export function checkStructural(input: GateInput): GateCheckResult {
  const reasons: Omit<GateFailureReason, 'check'>[] = [];
  if (MARKUP.test(input.childText)) reasons.push(reason('markup', 'Child text contains markup.'));
  if (CORRECT_MARKER.test(input.childText)) {
    reasons.push(reason('correct_marker', 'Child text leaks a correctness marker.'));
  }
  if (input.kind === 'multiple-choice') checkOptions(input, reasons);
  return reasons.length === 0 ? passed('structural') : failedMany('structural', reasons);
}

function checkOptions(
  input: Extract<GateInput, { kind: 'multiple-choice' }>,
  reasons: Omit<GateFailureReason, 'check'>[],
): void {
  const optionTexts = input.options.map((option) => option.text.trim().toLowerCase());
  if (new Set(optionTexts).size !== optionTexts.length) {
    reasons.push(reason('duplicate_options', 'Options must be distinct.'));
  }
  if (input.options.some((option) => MARKUP.test(option.text))) {
    reasons.push(reason('markup', 'An option contains markup.'));
  }
  if (input.options.some((option) => CORRECT_MARKER.test(option.text))) {
    reasons.push(reason('correct_marker', 'An option leaks a correctness marker.'));
  }

  const correctOptions = input.options.filter((option) => option.isCorrect);
  if (correctOptions.length !== 1) {
    reasons.push(reason('correct_option_count', 'Exactly one option must be marked correct.'));
  }
  const keyed = input.options.find((option) => option.id === input.answerKey);
  if (keyed === undefined)
    reasons.push(reason('missing_answer_key', 'Answer key names no option.'));
  else if (!keyed.isCorrect)
    reasons.push(reason('wrong_answer_key', 'Answer key names a wrong option.'));
}

function reason(code: string, message: string): Omit<GateFailureReason, 'check'> {
  return { code, message };
}
