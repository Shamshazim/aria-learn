import { describe, expect, it, vi } from 'vitest';

import { PROTOCOL_VERSION, tutorInputEventSchema, type Band, type TutorMove } from '@aria/shared';
import { createTeachingPolicy, type LoadedTurnContext, type PlannedTurn } from '@aria/tutor';

import { fixedClock } from '@/lib/clock';
import { sequentialIds } from '@/lib/ids';
import { scrubLearnerContext } from '@/privacy';
import { createQualityGate } from '@/quality';
import {
  createTurnContentService,
  type ApiModelContext,
} from '@/services/content/turn-content.service';
import { createMoveFactory } from '@/services/moves/move-factory';

const NOW = new Date('2026-08-25T10:00:00.000Z');
const BANDS: readonly Band[] = ['early', 'middle', 'senior'];

const SILENCE = tutorInputEventSchema.parse({
  id: 'event-silence',
  at: NOW.toISOString(),
  protocolVersion: PROTOCOL_VERSION,
  kind: 'SILENCE',
  waitedMs: 12_000,
});

const policy = createTeachingPolicy<ApiModelContext>({
  gradeAnswer: () => null,
  sessionLimitMs: () => 20 * 60_000,
  now: () => NOW,
});

/** No provider: every sentence is a reviewed fallback, so the texts are deterministic. */
function contentService() {
  return createTurnContentService({
    reliable: { resolve: vi.fn() },
    ai: null,
    gate: createQualityGate(() => ({ safe: true, categories: [] })),
    moves: (sessionId) =>
      createMoveFactory({ ids: sequentialIds('move'), clock: fixedClock(NOW), sessionId }),
    remediation: () => null,
  });
}

function context(band: Band, consecutiveSilences: number): LoadedTurnContext<ApiModelContext> {
  return {
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
      consecutiveSilences,
      repeatedMisconception: null,
      lastApproach: null,
      unmetPrerequisite: null,
    },
    modelContext: {
      scrubbed: scrubLearnerContext({ identifiers: {}, gradeBand: band }, { pseudonym: 'omit' }),
      answerKey: '7',
      latestQuestion: 'What is four plus three?',
      estimatedTokens: 0,
      retrievedFactIds: [],
      recentContentItemIds: [],
      arithmeticProblem: null,
      completionOnly: false,
      latestAsk: null,
    },
    recentKinds: [],
  };
}

type Rung = Readonly<{
  kind: TutorMove['kind'];
  approach: string;
  terminal: boolean;
  text: string;
}>;

/** Walks the ladder as a real session would: each silence sees the ones already committed. */
async function climbLadder(band: Band, rungs: number): Promise<readonly Rung[]> {
  const content = contentService();
  const climbed: Rung[] = [];
  for (let committed = 0; committed < rungs; committed += 1) {
    const loaded = context(band, committed);
    const decision = policy(loaded, SILENCE);
    const turn: PlannedTurn<ApiModelContext> = {
      event: SILENCE,
      context: loaded,
      decision,
      plan: decision.defaultPlan,
    };
    const resolved = await content.resolve(turn);
    climbed.push({
      kind: decision.defaultPlan.kind,
      approach: decision.defaultPlan.approach,
      terminal: decision.terminal,
      text: resolved.moves[0]?.speech?.text ?? '',
    });
    if (decision.terminal) break;
  }
  return climbed;
}

describe.each(BANDS)('silence escalation in the %s band', (band) => {
  it('climbs re-ask, nudge, check-in, stop and then ends the session', async () => {
    const climbed = await climbLadder(band, 6);

    expect(climbed.map((rung) => `${rung.kind}:${rung.approach}`)).toEqual([
      'SAY:reask-short',
      'HINT:single-nudge',
      'SAY:check-in',
      'BREAK:attention',
    ]);
  });

  it('never reaches a fifth silence move: the fourth ends the session', async () => {
    const climbed = await climbLadder(band, 6);

    expect(climbed).toHaveLength(4);
    expect(climbed.map((rung) => rung.terminal)).toEqual([false, false, false, true]);
  });

  it('says something different at every rung', async () => {
    const texts = (await climbLadder(band, 6)).map((rung) => rung.text);

    expect(texts.every((text) => text !== '')).toBe(true);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('never asks the child to listen: LISTEN is not an allowed move for silence', async () => {
    const climbed = await climbLadder(band, 6);

    expect(climbed.map((rung) => rung.kind)).not.toContain('LISTEN');
  });
});

describe('silence fuzz', () => {
  /**
   * Fifty turns of a child drifting in and out: some silences, some replies. The bar is the
   * one a child would notice — Aria never says the same sentence twice in a row. A seeded
   * generator keeps a failure reproducible.
   */
  it('never repeats itself across fifty turns of drifting attention', async () => {
    const content = contentService();
    let seed = 20_260_825;
    const next = (): number => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };
    let committedSilences = 0;
    let previous = '';
    for (let turn = 0; turn < 50; turn += 1) {
      // A child who says something resets the ladder; a silence climbs it.
      if (next() < 0.3) {
        committedSilences = 0;
        previous = '';
        continue;
      }
      const loaded = context('middle', committedSilences);
      const decision = policy(loaded, SILENCE);
      const resolved = await content.resolve({
        event: SILENCE,
        context: loaded,
        decision,
        plan: decision.defaultPlan,
      });
      const text = resolved.moves[0]?.speech?.text ?? '';
      expect(text, `turn ${String(turn)} repeated the previous sentence`).not.toBe(previous);
      previous = text;
      committedSilences = decision.terminal ? 0 : committedSilences + 1;
      if (decision.terminal) previous = '';
    }
  });
});
