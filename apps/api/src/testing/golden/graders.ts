import { createQualityGate } from '@/quality';
import { checkArithmetic } from '@/quality/arithmetic';
import type { CheckName, GoldenGeneration, GoldenItem, ItemResult } from '@/testing/golden/types';

const CVC = /^[bcdfghjklmnpqrstvwxyz][aeiou][bcdfghjklmnpqrstvwxyz]$/iu;

export function gradeGeneration(item: GoldenItem, output: GoldenGeneration): ItemResult {
  const text = `${output.prompt} ${output.answer}`;
  const gate = createQualityGate((value) => ({
    safe: !/\b(?:kill|weapon|sex|suicide)\b/iu.test(value),
    categories: [],
  }))({
    id: item.id,
    kind: 'text',
    band: item.band,
    childText: text,
    factual: false,
    grounding: 'reviewed-bank',
  });
  const arithmetic = item.expectation.arithmeticProblem;
  const checks: Partial<Record<CheckName, boolean>> = {
    ...(arithmetic === undefined
      ? {}
      : {
          arithmetic_correctness: checkArithmetic(arithmetic, output.answer).verdict === 'correct',
        }),
    ...(item.expectation.expectedAnswer === undefined
      ? {}
      : {
          factual_correctness:
            normalise(output.answer) === normalise(item.expectation.expectedAnswer),
        }),
    ...(item.expectation.multipleChoice === undefined
      ? {}
      : { correct_option_count: validMultipleChoice(output) }),
    reading_level: checkPassed(gate, 'level'),
    markup: !hasReason(gate, 'markup'),
    safety: checkPassed(gate, 'safety'),
    ...(item.expectation.decodablePattern === undefined
      ? {}
      : { decodable: CVC.test(normalise(output.answer)) }),
  };
  const failures: CheckName[] = [];
  for (const name of CHECK_NAMES) if (checks[name] === false) failures.push(name);
  return {
    itemId: item.id,
    latencyMs: output.latencyMs,
    costUsd: output.costUsd,
    checks,
    failures,
  };
}

function validMultipleChoice(output: GoldenGeneration): boolean {
  if (output.options === undefined || output.answerKey === undefined) return false;
  const matching = output.options.filter(
    (option) => normalise(option.text) === normalise(output.answer),
  );
  const keyed = output.options.find((option) => option.id === output.answerKey);
  return (
    matching.length === 1 &&
    keyed !== undefined &&
    normalise(keyed.text) === normalise(output.answer) &&
    new Set(output.options.map((option) => normalise(option.text))).size === output.options.length
  );
}

const CHECK_NAMES: readonly CheckName[] = [
  'arithmetic_correctness',
  'factual_correctness',
  'correct_option_count',
  'reading_level',
  'markup',
  'decodable',
  'safety',
];

function checkPassed(
  verdict: ReturnType<ReturnType<typeof createQualityGate>>,
  name: 'level' | 'safety',
): boolean {
  return verdict.checks.find((check) => check.check === name)?.passed ?? false;
}

function hasReason(
  verdict: ReturnType<ReturnType<typeof createQualityGate>>,
  code: string,
): boolean {
  return verdict.checks.some((check) => check.reasons.some((reason) => reason.code === code));
}

function normalise(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/u, '');
}
