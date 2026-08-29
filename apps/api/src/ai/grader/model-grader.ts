import type { AiClient } from '@/ai';
import type { ScrubbedContext } from '@/privacy';

/**
 * The second opinion on a short answer that did not match the key word for word.
 *
 * Most of the curriculum is prompted items whose key is a short string the model wrote
 * ("470 and 500"), and a child answers out loud: "five hundred and four hundred seventy" is
 * the same answer in different words. Exact matching marks it wrong and the child hears
 * "let's slow down" for being right, which is the one thing a tutor must never do. So the
 * mismatch goes to the FAST tier inside a hard budget; any failure — slow, down, nonsense —
 * returns no opinion and the exact match stands. The judge never overrules a match.
 */
export const GRADER_BUDGET_MS = 1_500;

export type AnswerJudgement = 'correct' | 'incorrect' | null;

export type JudgeFallbackReason = 'timeout' | 'provider_error' | 'disabled';

export type AnswerJudge = (
  input: Readonly<{
    question: string;
    expectedAnswer: string;
    learnerAnswer: string;
    context: ScrubbedContext;
    studentId: string;
  }>,
) => Promise<AnswerJudgement>;

export type ModelGraderDeps = Readonly<{
  ai: AiClient | null;
  budgetMs?: number;
  onFallback?: (reason: JudgeFallbackReason) => void;
}>;

const TIMED_OUT = Symbol('grader-budget-expired');

export function createModelGrader(deps: ModelGraderDeps): AnswerJudge {
  return async (input) => {
    if (deps.ai === null) {
      deps.onFallback?.('disabled');
      return null;
    }
    const budgetMs = deps.budgetMs ?? GRADER_BUDGET_MS;
    const controller = new AbortController();
    let expired: ReturnType<typeof setTimeout> | undefined;
    const budget = new Promise<typeof TIMED_OUT>((resolve) => {
      expired = setTimeout(() => {
        controller.abort();
        resolve(TIMED_OUT);
      }, budgetMs);
    });
    try {
      const result = await Promise.race([
        deps.ai.run(
          'grade-short-answer',
          {
            context: input.context,
            question: input.question,
            expectedAnswer: input.expectedAnswer,
            learnerAnswer: input.learnerAnswer,
          },
          { studentId: input.studentId, signal: controller.signal, timeoutMs: budgetMs },
        ),
        budget,
      ]);
      if (result === TIMED_OUT) {
        deps.onFallback?.('timeout');
        return null;
      }
      return result.data.verdict;
    } catch {
      deps.onFallback?.(controller.signal.aborted ? 'timeout' : 'provider_error');
      return null;
    } finally {
      clearTimeout(expired);
    }
  };
}
