import type { TutorInputEvent } from '@aria/shared';
import type { LoadedTurnContext, TutorPorts } from '@aria/tutor';

import type { AiClient } from '@/ai';
import { plannerBudgetMs } from '@/ai/planner/planner.budget';
import type { PlanMovePromptInput } from '@/ai/prompts/types';
import type { ApiModelContext } from '@/services/content/turn-content.service';

type PlanRequest = Parameters<TutorPorts<ApiModelContext>['planMove']>[0];

const MAX_UTTERANCE_LENGTH = 500;
const RECENT_TURNS = 3;

/**
 * A planner below this is guessing, and a guess is worth less than the policy's own plan,
 * which was written by people who know what a second wrong answer means.
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
}): TutorPorts<ApiModelContext>['planMove'] {
  return async (request) => {
    if (deps.ai === null) return request.fallback;
    const result = await deps.ai.run('plan-move', promptInput(request), {
      studentId: request.context.session.studentId,
      timeoutMs: plannerBudgetMs(request.context.session.band, request.event),
    });
    if (result.data.confidence < PLANNER_MIN_CONFIDENCE) return request.fallback;
    return {
      ...request.fallback,
      kind: result.data.kind,
      approach: result.data.approach,
      rationale: result.data.rationale,
    };
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
    recentIntents: recentTurns(context),
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

function recentTurns(context: LoadedTurnContext<ApiModelContext>): string {
  const recent = context.recentKinds.slice(-RECENT_TURNS);
  return recent.length === 0 ? 'nothing yet' : recent.join(', ');
}
