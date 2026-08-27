import { AUTHORED_MISCONCEPTIONS, predictedAnswers } from '@/curriculum/misconceptions';
import type { ArithmeticProblem } from '@/quality/arithmetic';
import { checkArithmetic } from '@/quality/arithmetic';

export type Distractor = Readonly<{ text: string; misconceptionId: string | null }>;

/**
 * Wrong options built from the wrong ideas we know about (P2H-10).
 *
 * A distractor that is merely a plausible number tells us the child was wrong. One built from
 * a misconception signature tells us *which* wrong idea they had, which is the difference
 * between another hint and the right reteach. Near-misses only fill in behind them, and are
 * labelled `null` so nothing later mistakes a filler for evidence.
 */
export function buildDistractors(
  input: Readonly<{ problem: ArithmeticProblem; answer: string; count: number }>,
): readonly Distractor[] {
  const taken = new Set([normalise(input.answer)]);
  const distractors: Distractor[] = [];
  for (const candidate of fromMisconceptions(input.problem, input.answer)) {
    if (distractors.length >= input.count) break;
    if (taken.has(normalise(candidate.text)) || isCorrect(input.problem, candidate.text)) continue;
    taken.add(normalise(candidate.text));
    distractors.push(candidate);
  }
  for (const text of nearMisses(input.problem, input.answer)) {
    if (distractors.length >= input.count) break;
    if (taken.has(normalise(text)) || isCorrect(input.problem, text)) continue;
    taken.add(normalise(text));
    distractors.push({ text, misconceptionId: null });
  }
  return distractors;
}

function fromMisconceptions(problem: ArithmeticProblem, answer: string): readonly Distractor[] {
  return AUTHORED_MISCONCEPTIONS.filter(
    (misconception) => misconception.skillCode === problem.skillCode,
  ).flatMap((misconception) =>
    predictedAnswers(misconception.detects, {
      skillCode: problem.skillCode,
      question: null,
      expectedAnswer: answer,
      learnerAnswer: '',
      problem,
    }).map((text) => ({ text, misconceptionId: misconception.id })),
  );
}

/**
 * The fillers, when the signatures produce too few.
 *
 * Numeric answers get their neighbours, because being one out is the ordinary way to be wrong.
 * Relation answers get the rest of their alphabet, which is the whole space there is.
 */
function nearMisses(problem: ArithmeticProblem, answer: string): readonly string[] {
  if (problem.kind === 'fraction-comparison') return ['<', '=', '>'];
  if (problem.kind === 'fraction-equality') return ['equal', 'not equal'];
  const key = Number.parseInt(answer, 10);
  if (Number.isNaN(key)) return [];
  return [key + 1, key - 1, key + 10, key - 10].filter((value) => value >= 0).map(String);
}

/** A "wrong" option the checker calls correct is not a distractor, it is a second answer. */
function isCorrect(problem: ArithmeticProblem, candidate: string): boolean {
  return checkArithmetic(problem, candidate).verdict === 'correct';
}

function normalise(value: string): string {
  return value.trim().toLocaleLowerCase();
}
