import { z } from 'zod';

import type { TutorMove } from '@aria/shared';
import type { PlannedTurn, ResolvedContent } from '@aria/tutor';

import type { AiClient } from '@/ai';
import type { ReliableContentService } from '@/content/content.service';
import type { ScrubbedContext } from '@/privacy';
import type { QualityGate } from '@/quality';
import { arithmeticProblemSchema, type ArithmeticProblem } from '@/quality/arithmetic';
import { eventText, fallbackText } from '@/services/content/turn-fallback';
import { responseMove } from '@/services/content/turn-response';
import type { MoveFactory } from '@/services/moves/move-factory';

export type ApiModelContext = Readonly<{
  scrubbed: ScrubbedContext;
  answerKey: string | null;
  latestQuestion: string | null;
  estimatedTokens: number;
  retrievedFactIds: readonly string[];
  recentContentItemIds: readonly string[];
  arithmeticProblem: ArithmeticProblem | null;
  completionOnly: boolean;
  latestAsk: Extract<TutorMove, { kind: 'ASK' }> | null;
}>;

const questionBodySchema = z
  .object({
    prompt: z.string().min(1).max(2_000),
    choices: z.array(z.string().min(1).max(300)).min(2).max(8).optional(),
    answerKey: z.string().min(1).max(500).optional(),
    arithmeticProblem: arithmeticProblemSchema.optional(),
    completionOnly: z.boolean().optional(),
  })
  .loose();

export type TurnContentService = Readonly<{
  resolve(turn: PlannedTurn<ApiModelContext>, signal?: AbortSignal): Promise<ResolvedContent>;
}>;

export function createTurnContentService(deps: {
  reliable: ReliableContentService;
  ai: AiClient | null;
  gate: QualityGate;
  moves(sessionId: string): MoveFactory;
  remediation(misconceptionId: string): string | null;
}): TurnContentService {
  return {
    resolve: (turn: PlannedTurn<ApiModelContext>, signal?: AbortSignal) =>
      resolve(deps, turn, signal),
  };
}

async function resolve(
  deps: Parameters<typeof createTurnContentService>[0],
  turn: PlannedTurn<ApiModelContext>,
  signal?: AbortSignal,
): Promise<ResolvedContent> {
  throwIfAborted(signal);
  if (turn.plan.kind === 'ASK') return resolveQuestion(deps, turn, signal);
  const remediation = currentRemediation(deps, turn);
  if (remediation !== null) {
    const text = requiredGatedText(deps.gate, remediation, turn.context.session.band);
    return responseWithContinuation(deps, turn, text, signal);
  }
  const generated = await generateGatedText(deps.ai, deps.gate, turn, signal);
  throwIfAborted(signal);
  const text =
    generated ?? requiredGatedText(deps.gate, fallbackText(turn), turn.context.session.band);
  return responseWithContinuation(deps, turn, text, signal);
}

function currentRemediation(
  deps: Parameters<typeof createTurnContentService>[0],
  turn: PlannedTurn<ApiModelContext>,
): string | null {
  const id =
    turn.plan.kind === 'RETEACH'
      ? (turn.decision.graded?.misconception ?? turn.context.session.repeatedMisconception)
      : null;
  return id === null ? null : deps.remediation(id);
}

async function generateGatedText(
  ai: AiClient | null,
  gate: QualityGate,
  turn: PlannedTurn<ApiModelContext>,
  signal?: AbortSignal,
): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const candidate = await generateText(ai, turn, signal);
    if (candidate === null) return null;
    if (passes(gate, candidate, turn.context.session.band)) return candidate;
  }
  return null;
}

async function resolveQuestion(
  deps: Parameters<typeof createTurnContentService>[0],
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
  deps: Parameters<typeof createTurnContentService>[0],
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

function contextEvidence(turn: PlannedTurn<ApiModelContext>): Readonly<Record<string, unknown>> {
  return {
    contextTokens: turn.context.modelContext.estimatedTokens,
    retrievedFactIds: turn.context.modelContext.retrievedFactIds,
  };
}

async function generateText(
  ai: AiClient | null,
  turn: PlannedTurn<ApiModelContext>,
  signal?: AbortSignal,
): Promise<string | null> {
  if (ai === null) return null;
  try {
    if (turn.plan.kind === 'HINT') {
      const result = await ai.run(
        'hint',
        {
          context: turn.context.modelContext.scrubbed,
          problem:
            turn.context.modelContext.latestQuestion ??
            turn.context.session.skillCode ??
            'practice',
          learnerAnswer: eventText(turn),
        },
        { studentId: turn.context.session.studentId, ...(signal === undefined ? {} : { signal }) },
      );
      return result.data.hint;
    }
    if (turn.plan.kind === 'SAY' || turn.plan.kind === 'RETEACH') {
      const result = await ai.run(
        'explain',
        {
          context: turn.context.modelContext.scrubbed,
          concept: turn.context.session.skillCode ?? turn.context.session.subject,
          learnerQuestion: eventText(turn) ?? 'Please explain this in a different way.',
          approach: turn.plan.approach,
        },
        { studentId: turn.context.session.studentId, ...(signal === undefined ? {} : { signal }) },
      );
      return result.data.explanation;
    }
  } catch {
    throwIfAborted(signal);
    return null;
  }
  return null;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) throw new DOMException('Tutor turn aborted', 'AbortError');
}

function requiredGatedText(
  gate: QualityGate,
  text: string,
  band: PlannedTurn<ApiModelContext>['context']['session']['band'],
  generated = false,
): string {
  if (!passes(gate, text, band, generated))
    throw new Error('Child-facing turn content failed the quality gate');
  return text;
}

function passes(
  gate: QualityGate,
  text: string,
  band: Parameters<typeof requiredGatedText>[2],
  generated = true,
): boolean {
  return (
    gate({
      id: 'turn-text',
      kind: 'text',
      band,
      childText: text,
      factual: false,
      grounding: generated ? 'unsupported' : 'reviewed-bank',
    }).verdict === 'pass'
  );
}

async function responseWithContinuation(
  deps: Parameters<typeof createTurnContentService>[0],
  turn: PlannedTurn<ApiModelContext>,
  text: string,
  signal?: AbortSignal,
): Promise<ResolvedContent> {
  const feedback = responseMove(deps.moves(turn.context.session.id), turn, text);
  if (turn.plan.kind === 'HINT' || turn.plan.kind === 'RETEACH') {
    const prior = turn.context.modelContext.latestAsk;
    return {
      moves: prior === null ? [feedback] : [feedback, retryAsk(deps, turn, prior)],
      privateEvidence: contextEvidence(turn),
    };
  }
  if (!['PRAISE', 'REVEAL', 'SWITCH'].includes(turn.plan.kind)) {
    return { moves: [feedback], privateEvidence: contextEvidence(turn) };
  }
  const next = await resolveQuestion(
    deps,
    { ...turn, plan: { ...turn.plan, kind: 'ASK', attempt: 1 } },
    signal,
  );
  return { moves: [feedback, ...next.moves], privateEvidence: next.privateEvidence };
}

function retryAsk(
  deps: Parameters<typeof createTurnContentService>[0],
  turn: PlannedTurn<ApiModelContext>,
  prior: Extract<TutorMove, { kind: 'ASK' }>,
): TutorMove {
  return deps.moves(turn.context.session.id).make({
    kind: 'ASK',
    skillId: prior.skillId,
    itemId: prior.itemId,
    attempt: Math.min(10, prior.attempt + 1),
    vocabularyHint: prior.vocabularyHint,
    speech: prior.speech,
    display: prior.display,
    expects: prior.expects,
  });
}
