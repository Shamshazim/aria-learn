import type { TutorInputEvent } from '@aria/shared';
import type { LoadedTurnContext, TutorPorts } from '@aria/tutor';

import type { AiClient } from '@/ai';
import { plannerBudgetMs } from '@/ai/planner/planner.budget';
import type { PlanMovePromptInput } from '@/ai/prompts/types';
import type { ApiModelContext } from '@/services/content/turn-content.service';

type PlanRequest = Parameters<TutorPorts<ApiModelContext>['planMove']>[0];

const MAX_UTTERANCE_LENGTH = 500;
const RECENT_INTENTS = 3;

/**
 * A planner below this is guessing, and a guess is worth less than the policy's own plan,
 * which was written by people who know what a second wrong answer means. Overridable because
 * what a given model's stated confidence is worth is a property of that model, not of teaching.
 */
export const PLANNER_MIN_CONFIDENCE = 0.4;

/**
 * The planner port (P2H-06): one TEACH-tier call that chooses a move and an approach from the
 * set the policy allows.
 *
 * It proposes; it does not decide. Everything that keeps a proposal honest — the allowed set,
 * the budget, the rejection — lives in `@aria/tutor`, so this file cannot widen its own
 * authority by changing what it returns. Returning the fallback means "no opinion".
 */
export function createModelPlanner(deps: {
  ai: AiClient | null;
  minConfidence?: number;
}): TutorPorts<ApiModelContext>['planMove'] {
  const minConfidence = deps.minConfidence ?? PLANNER_MIN_CONFIDENCE;
  return async (request) => {
    if (deps.ai === null) return request.fallback;
    // The same number bounds the call twice on purpose: `@aria/tutor` races it so the child's
    // turn moves on, and this timeout is what actually abandons the request, so a provider
    // that lost the race is not left holding a connection. The signal aborts at the same
    // moment so the retry loop does not start a second attempt the turn has already left.
    const budgetMs = plannerBudgetMs(request.context.session.band, request.event);
    const controller = new AbortController();
    const expired = setTimeout(() => {
      controller.abort();
    }, budgetMs);
    try {
      const result = await deps.ai.run('plan-move', promptInput(request), {
        studentId: request.context.session.studentId,
        timeoutMs: budgetMs,
        signal: controller.signal,
      });
      if (result.data.confidence < minConfidence) return request.fallback;
      return {
        ...request.fallback,
        kind: result.data.kind,
        approach: result.data.approach,
        rationale: result.data.rationale,
      };
    } finally {
      clearTimeout(expired);
    }
  };
}

function promptInput(request: PlanRequest): PlanMovePromptInput {
  const { context, event, allowedMoves } = request;
  return {
    context: context.modelContext.scrubbed,
    band: context.session.band,
    skill: context.session.skillCode ?? 'general practice',
    question: context.modelContext.latestQuestion ?? 'no open item yet',
    learnerSaid: learnerSaid(event),
    state: describeState(context),
    recentIntents: recentIntents(context),
    allowed: allowedMoves,
  };
}

function learnerSaid(event: TutorInputEvent): string {
  const said = spokenText(event);
  return said.slice(0, MAX_UTTERANCE_LENGTH);
}

function spokenText(event: TutorInputEvent): string {
  switch (event.kind) {
    case 'ANSWER':
      return event.text ?? event.choiceId ?? '(chose an option)';
    case 'QUESTION':
    case 'SPEECH_FINAL':
    case 'SPEECH_PARTIAL':
      return event.text;
    case 'SILENCE':
      return '(said nothing)';
    default:
      return `(${event.kind})`;
  }
}

/** What the planner needs to know about how the item is going, without the answer key. */
function describeState(context: LoadedTurnContext<ApiModelContext>): string {
  const { attempts, consecutiveWrong, lastApproach, repeatedMisconception } = context.session;
  const parts = [
    `attempt ${String(attempts + 1)}`,
    `${String(consecutiveWrong)} wrong in a row`,
    lastApproach === null ? 'no approach tried yet' : `last approach: ${lastApproach}`,
  ];
  if (repeatedMisconception !== null) parts.push('the same misconception has appeared before');
  return parts.join(', ');
}

/** What the child has been doing, in the classifier's words rather than the protocol's. */
function recentIntents(context: LoadedTurnContext<ApiModelContext>): string {
  const recent = context.modelContext.recentIntents.slice(-RECENT_INTENTS);
  return recent.length === 0 ? 'nothing yet' : recent.join(', ');
}
