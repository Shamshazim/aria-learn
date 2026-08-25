import { z } from 'zod';

import type { TutorMove } from '@aria/shared';
import type { PlannedTurn, ResolvedContent } from '@aria/tutor';

import { arithmeticProblemSchema } from '@/quality/arithmetic';
import { requiredGatedText, throwIfAborted } from '@/services/content/generate-text';
import type { ApiModelContext, TurnContentDeps } from '@/services/content/turn-content.types';
import { responseMove } from '@/services/content/turn-response';

/**
 * The practice item half of a turn (P1-07).
 *
 * It is separate from the response half because it obeys different rules: an item comes from
 * the verified bank, is gated whole, and carries an answer key that never reaches a prompt.
 * A response is Aria talking, and may be streamed a sentence at a time (P2H-07).
 */
const questionBodySchema = z
  .object({
    prompt: z.string().min(1).max(2_000),
    choices: z.array(z.string().min(1).max(300)).min(2).max(8).optional(),
    answerKey: z.string().min(1).max(500).optional(),
    arithmeticProblem: arithmeticProblemSchema.optional(),
    completionOnly: z.boolean().optional(),
  })
  .loose();

export async function resolveQuestion(
  deps: TurnContentDeps,
  turn: PlannedTurn<ApiModelContext>,
  signal?: AbortSignal,
): Promise<ResolvedContent> {
  throwIfAborted(signal);
  const skillCode = turn.plan.skillCode;
  if (skillCode === null) return resolveOpenQuestion(deps, turn);
  const content = await deps.reliable.resolve(
    {
      kind: 'question',
      skillCode,
      band: turn.context.session.band,
      studentId: turn.context.session.studentId,
      excludeIds: turn.context.modelContext.recentContentItemIds,
    },
    signal,
  );
  throwIfAborted(signal);
  const body = questionBodySchema.parse(content.body);
  const display = questionDisplay(body);
  for (const childText of [body.prompt, ...(body.choices ?? [])]) {
    requiredGatedText(
      deps.gate,
      childText,
      turn.context.session.band,
      content.source === 'generated',
    );
  }
  const move = deps.moves(turn.context.session.id).make({
    kind: 'ASK',
    skillId: skillCode,
    itemId: content.itemId ?? `fallback-${skillCode}`,
    attempt: turn.plan.attempt,
    speech: { text: body.prompt },
    display,
    expects: body.choices === undefined ? 'text' : 'choice',
  });
  return {
    moves: [move],
    privateEvidence: {
      ...contextEvidence(turn),
      answerKey: body.answerKey ?? null,
      arithmeticProblem: body.arithmeticProblem ?? null,
      completionOnly: body.completionOnly ?? false,
      contentSource: content.source,
      approach: turn.plan.approach,
      ...(content.itemId === null ? {} : { contentItemId: content.itemId }),
    },
  };
}

function resolveOpenQuestion(
  deps: TurnContentDeps,
  turn: PlannedTurn<ApiModelContext>,
): ResolvedContent {
  const text = requiredGatedText(deps.gate, 'What do you think?', turn.context.session.band);
  return {
    moves: [responseMove(deps.moves(turn.context.session.id), turn, text)],
    privateEvidence: contextEvidence(turn),
  };
}

function questionDisplay(body: z.infer<typeof questionBodySchema>): TutorMove['display'] {
  return body.choices === undefined
    ? [{ type: 'text', body: body.prompt, markdown: false }]
    : [
        {
          type: 'choices',
          options: body.choices.map((choice) => ({ id: choice, label: choice })),
        },
      ];
}

export function contextEvidence(
  turn: PlannedTurn<ApiModelContext>,
): Readonly<Record<string, unknown>> {
  return {
    contextTokens: turn.context.modelContext.estimatedTokens,
    retrievedFactIds: turn.context.modelContext.retrievedFactIds,
  };
}

/** The same item again, so a hint or a reteach is followed by the question it was about. */
export function retryAsk(
  deps: TurnContentDeps,
  turn: PlannedTurn<ApiModelContext>,
  prior: Extract<TutorMove, { kind: 'ASK' }>,
  countAttempt: boolean,
): TutorMove {
  return deps.moves(turn.context.session.id).make({
    kind: 'ASK',
    skillId: prior.skillId,
    itemId: prior.itemId,
    attempt: countAttempt ? Math.min(10, prior.attempt + 1) : prior.attempt,
    vocabularyHint: prior.vocabularyHint,
    speech: prior.speech,
    display: prior.display,
    expects: prior.expects,
  });
}
