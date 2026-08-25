import { describe, expect, it, vi } from 'vitest';

import { PROTOCOL_VERSION, tutorInputEventSchema, type MoveKind } from '@aria/shared';
import type { LoadedTurnContext, MovePlan, TutorPorts } from '@aria/tutor';

import { createAiClient, type AiClient } from '@/ai';
import { createModelPlanner, PLANNER_MIN_CONFIDENCE } from '@/ai/planner/model-planner';
import { PLANNER_TEXT_BUDGET_MS, plannerBudgetMs } from '@/ai/planner/planner.budget';
import type { LlmResponse } from '@/ai/provider';
import { scrubLearnerContext } from '@/privacy';
import type { ApiModelContext } from '@/services/content/turn-content.service';

/** A string no prompt has a reason to contain unless the answer key leaked into it. */
const ANSWER_KEY = 'seventeen-thousand-and-one';

const ANSWER = tutorInputEventSchema.parse({
  id: 'event-1',
  at: '2026-08-25T10:00:00.000Z',
  protocolVersion: PROTOCOL_VERSION,
  kind: 'ANSWER',
  respondsTo: 'ask-1',
  text: 'five',
});

const SPOKEN = tutorInputEventSchema.parse({
  id: 'event-2',
  at: '2026-08-25T10:00:00.000Z',
  protocolVersion: PROTOCOL_VERSION,
  kind: 'SPEECH_FINAL',
  text: 'five',
  confidence: 0.9,
});

const FALLBACK: MovePlan = {
  kind: 'HINT',
  approach: 'single-nudge',
  reason: 'This is the first incorrect attempt.',
  skillCode: 'ADD.WITHIN_10',
  attempt: 1,
  source: 'policy',
};

function context(): LoadedTurnContext<ApiModelContext> {
  return {
    session: {
      id: 'session-1',
      studentId: 'student-1',
      subject: 'math',
      grade: '4',
      band: 'middle',
      skillCode: 'ADD.WITHIN_10',
      startedAt: new Date('2026-08-25T09:55:00.000Z'),
      attempts: 1,
      consecutiveWrong: 1,
      consecutiveSilences: 0,
      repeatedMisconception: null,
      lastApproach: 'single-nudge',
      unmetPrerequisite: null,
    },
    modelContext: {
      scrubbed: scrubLearnerContext(
        {
          identifiers: {},
          gradeBand: 'middle',
          recentDialogue: [{ speaker: 'aria', text: 'What is four plus three?' }],
        },
        { pseudonym: 'omit' },
      ),
      answerKey: ANSWER_KEY,
      latestQuestion: 'What is four plus three?',
      estimatedTokens: 0,
      retrievedFactIds: [],
      recentContentItemIds: [],
      arithmeticProblem: null,
      completionOnly: false,
      latestAsk: null,
    },
    recentKinds: ['ASK', 'ANSWER', 'HINT'],
  };
}

/** Only the parts of a request this test reads: naming the port's type is not allowed here. */
type SeenRequest = Readonly<{ system: string; user: string; timeoutMs?: number | undefined }>;

function clientOver(
  body: unknown,
  seen: SeenRequest[] = [],
): Readonly<{ ai: AiClient; seen: SeenRequest[] }> {
  const response: LlmResponse = {
    text: JSON.stringify(body),
    endpointName: 'teach-primary',
    model: 'teach-model',
    tokensIn: 200,
    tokensOut: 40,
    costUsd: 0,
    latencyMs: 1,
    finishReason: 'stop',
  };
  const ai = createAiClient({
    provider: {
      complete: (request) => {
        seen.push(request);
        return Promise.resolve(response);
      },
      stream: async function* () {
        yield await Promise.resolve({ kind: 'complete', response } as const);
      },
    },
    accounting: {
      assertWithinCap: vi.fn(() => Promise.resolve()),
      record: vi.fn(() => Promise.resolve()),
      recordCachedHit: vi.fn(() => Promise.resolve()),
    },
    now: () => 0,
  });
  return { ai, seen };
}

const allowed: readonly MoveKind[] = ['HINT', 'RETEACH'];

const ask = (planner: TutorPorts<ApiModelContext>['planMove'], event = ANSWER): Promise<MovePlan> =>
  planner({ context: context(), event, allowedMoves: allowed, fallback: FALLBACK });

describe('the model planner', () => {
  it('proposes the move and approach the model chose', async () => {
    const { ai } = clientOver({
      kind: 'RETEACH',
      approach: 'concrete-story',
      rationale: 'The same nudge already failed once.',
      confidence: 0.8,
    });
    await expect(ask(createModelPlanner({ ai }))).resolves.toMatchObject({
      kind: 'RETEACH',
      approach: 'concrete-story',
      rationale: 'The same nudge already failed once.',
      skillCode: 'ADD.WITHIN_10',
    });
  });

  it('never puts the answer key in the prompt', async () => {
    const { ai, seen } = clientOver({
      kind: 'RETEACH',
      approach: 'visual-model',
      rationale: 'Try a picture.',
      confidence: 0.9,
    });
    await ask(createModelPlanner({ ai }));
    const request = seen[0];
    expect(request).toBeDefined();
    expect(`${request?.system ?? ''}\n${request?.user ?? ''}`).not.toContain(ANSWER_KEY);
  });

  it('offers the allowed moves and only their approaches', async () => {
    const { ai, seen } = clientOver({
      kind: 'HINT',
      approach: 'point-to-step',
      rationale: 'One step is enough.',
      confidence: 0.9,
    });
    await ask(createModelPlanner({ ai }));
    const user = seen[0]?.user ?? '';
    expect(user).toContain('- HINT (point-to-step | worked-similar | narrow-choice)');
    expect(user).toContain('- RETEACH (visual-model | concrete-story | simpler-case)');
    expect(user).not.toContain('- REVEAL');
  });

  it('declines rather than guesses when it is unsure', async () => {
    const { ai } = clientOver({
      kind: 'RETEACH',
      approach: 'visual-model',
      rationale: 'Maybe.',
      confidence: PLANNER_MIN_CONFIDENCE - 0.01,
    });
    await expect(ask(createModelPlanner({ ai }))).resolves.toEqual(FALLBACK);
  });

  it('declines when no provider is configured', async () => {
    await expect(ask(createModelPlanner({ ai: null }))).resolves.toEqual(FALLBACK);
  });

  it('spends no longer than the band budget, and half of it on the voice channel', async () => {
    const { ai, seen } = clientOver({
      kind: 'HINT',
      approach: 'point-to-step',
      rationale: 'One step.',
      confidence: 0.9,
    });
    const planner = createModelPlanner({ ai });
    await ask(planner);
    await ask(planner, SPOKEN);
    expect(seen[0]?.timeoutMs).toBe(PLANNER_TEXT_BUDGET_MS.middle);
    expect(seen[1]?.timeoutMs).toBe(PLANNER_TEXT_BUDGET_MS.middle / 2);
    expect(plannerBudgetMs('early', ANSWER)).toBe(PLANNER_TEXT_BUDGET_MS.early);
  });
});
