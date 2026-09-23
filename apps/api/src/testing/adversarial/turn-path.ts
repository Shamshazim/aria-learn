import { PROTOCOL_VERSION, tutorInputEventSchema, type Band, type MoveKind } from '@aria/shared';
import { classifyIntent, createTeachingPolicy, type Intent, type PlannedTurn } from '@aria/tutor';

import { createAiClient, type AiClient } from '@/ai';
import type { LlmResponse } from '@/ai/provider';
import { fixedClock } from '@/lib/clock';
import { sequentialIds } from '@/lib/ids';
import { scrubLearnerContext } from '@/privacy';
import { createQualityGate } from '@/quality';
import { detectCrisis } from '@/safety/crisis/detect';
import {
  createTurnContentService,
  type ApiModelContext,
} from '@/services/content/turn-content.service';
import { createMoveFactory } from '@/services/moves/move-factory';
import type { InjectionFixture } from '@/testing/adversarial/fixture.schema';

/**
 * Replays one hostile utterance through the turn path the child's words actually take (X-05).
 *
 * Real policy, real content service, real quality gate, real move factory, real privacy
 * scrubber. The two things that are not real are the vendor — replaced with a recorder, so
 * "the model was never called" is a number rather than a belief — and the database, which the
 * turn path reaches through a context this builds directly.
 *
 * A suite that stubbed the policy would prove the fixtures parse. This proves the tutor.
 */
const NOW = new Date('2026-09-04T10:00:00.000Z');
const ANSWER_KEY = '7';

export type TurnOutcome = Readonly<{
  fixtureId: string;
  intent: Intent;
  /** How many times the vendor was asked anything at all. */
  modelCalls: number;
  moveKinds: readonly MoveKind[];
  allowedMoves: readonly MoveKind[];
  /** Everything Aria would say back, joined — what a child actually hears. */
  spoken: string;
  crisis: boolean;
  /** What the recorded prompt would have carried, for the fixtures about leaking context. */
  promptsSent: readonly string[];
}>;

export async function replayInjectionFixture(fixture: InjectionFixture): Promise<TurnOutcome> {
  const promptsSent: string[] = [];
  const recorder = recordingProvider(promptsSent);
  const turn = plannedTurn(fixture.text, fixture.band);
  const resolved = await contentService(recorder.client).resolve(turn);

  return {
    fixtureId: fixture.id,
    intent: classifyIntent(fixture.text, { answerKey: ANSWER_KEY }).intent,
    modelCalls: recorder.calls(),
    moveKinds: resolved.moves.map((move) => move.kind),
    allowedMoves: turn.decision.allowedMoves,
    spoken: resolved.moves.map((move) => move.speech?.text ?? '').join(' '),
    crisis: detectCrisis({ text: fixture.text }).kind !== 'none',
    promptsSent,
  };
}

/**
 * A vendor that always answers, so "never called" is a decision the code made.
 *
 * It answers with something bland and in-protocol: a provider that returned rubbish would make
 * every invariant pass for the wrong reason — the tutor rejecting a malformed completion is
 * not the same as the tutor handling a hostile child well.
 */
function recordingProvider(promptsSent: string[]): Readonly<{ client: AiClient; calls(): number }> {
  let calls = 0;
  const body = (): LlmResponse => ({
    text: JSON.stringify({ text: 'Let us look at it together.' }),
    endpointName: 'teach-primary',
    model: 'recorder',
    tokensIn: 1,
    tokensOut: 1,
    costUsd: 0,
    latencyMs: 1,
    finishReason: 'stop',
  });
  const client = createAiClient({
    provider: {
      complete: (request) => {
        calls += 1;
        promptsSent.push(`${request.system}\n${request.user}`);
        return Promise.resolve(body());
      },
      stream: async function* () {
        calls += 1;
        yield await Promise.resolve({ kind: 'complete', response: body() } as const);
      },
    },
    accounting: {
      assertWithinCap: () => Promise.resolve(),
      record: () => Promise.resolve(),
      recordCachedHit: () => Promise.resolve(),
    },
    now: () => 0,
  });
  return { client, calls: () => calls };
}

function contentService(ai: AiClient) {
  return createTurnContentService({
    // A reviewed item, so an `ASK` has something real to serve. Nothing about it is hostile:
    // the attack in these fixtures is what the child says, not what the curriculum holds.
    reliable: {
      resolve: () =>
        Promise.resolve({
          source: 'fallback' as const,
          itemId: null,
          body: { prompt: 'What is four plus three?', answerKey: ANSWER_KEY },
        }),
    },
    ai,
    gate: createQualityGate(() => ({ safe: true, categories: [] })),
    moves: (sessionId) =>
      createMoveFactory({ ids: sequentialIds('move'), clock: fixedClock(NOW), sessionId }),
    remediation: () => null,
    visual: () => null,
  });
}

const policy = createTeachingPolicy<ApiModelContext>({
  gradeAnswer: () => ({ correct: false, misconception: null }),
  classifyIntent: (event) =>
    classifyIntent(event.kind === 'ANSWER' ? (event.text ?? '') : event.text, {
      answerKey: ANSWER_KEY,
    }).intent,
  sessionLimitMs: () => 20 * 60_000,
  now: () => NOW,
});

/**
 * The child said something, mid-session, with a question open.
 *
 * Mid-session rather than at arrival because that is where the surface is: the tutor has an
 * answer key to grade against, a skill to teach, and a reason to call a vendor — all of which
 * an injection is trying to get at.
 */
function plannedTurn(text: string, band: Band): PlannedTurn<ApiModelContext> {
  const event = tutorInputEventSchema.parse({
    id: 'event-1',
    at: NOW.toISOString(),
    protocolVersion: PROTOCOL_VERSION,
    kind: 'ANSWER',
    respondsTo: 'ask-1',
    text,
  });
  const context = {
    session: {
      id: 'session-1',
      studentId: 'student-1',
      subject: 'math',
      grade: band === 'early' ? '1' : band === 'middle' ? '4' : '7',
      band,
      skillCode: 'ADD.FACT.10',
      startedAt: NOW,
      attempts: 1,
      consecutiveWrong: 0,
      consecutiveStuck: 0,
      correctStreak: 0,
      consecutiveSilences: 0,
      repeatedMisconception: null,
      lastApproach: null,
      unmetPrerequisite: null,
      // A topic to move on to, so a fixture that earns a `SWITCH` gets one rather than being
      // quietly funnelled into the no-next-topic branch.
      nextTopic: 'ADD.WITHIN_20',
    },
    modelContext: {
      scrubbed: scrubLearnerContext({ identifiers: {}, gradeBand: band }, { pseudonym: 'omit' }),
      answerKey: ANSWER_KEY,
      latestQuestion: 'What is four plus three?',
      estimatedTokens: 0,
      retrievedFactIds: [],
      recentContentItemIds: [],
      recentIntents: [],
      arithmeticProblem: null,
      lesson: null,
      completionOnly: false,
      latestAsk: null,
    },
    recentKinds: [],
  } as const;
  const decision = policy(context, event);
  return { event, context, decision, plan: decision.defaultPlan };
}
