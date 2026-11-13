import { describe, expect, it } from 'vitest';

import {
  PROTOCOL_VERSION,
  SKIP_REASONS,
  tutorInputEventSchema,
  type TutorInputEvent,
} from '@aria/shared';

import { createTeachingPolicy } from './teaching-policy';

import type { LoadedTurnContext, SessionSnapshot } from '../types';

/**
 * P3-07 acceptance: "a `procedure` item never resolves to a REVEAL of the final answer before
 * all steps are attempted". Checked two ways: a long division walked by hand, and 1,000 random
 * streams of wrong answers, shrugs and skips with a planner that picks anything it is offered.
 */
const AT = '2026-11-12T20:00:00.000Z';

function event(fields: Readonly<Record<string, unknown>>): TutorInputEvent {
  return tutorInputEventSchema.parse({
    id: 'event-1',
    at: AT,
    protocolVersion: PROTOCOL_VERSION,
    ...fields,
  });
}

const ANSWER = event({ kind: 'ANSWER', respondsTo: 'ask-1', text: '39' });

function context(session: Partial<SessionSnapshot>): LoadedTurnContext<null> {
  return {
    session: {
      id: 'session-1',
      studentId: 'student-1',
      subject: 'arithmetic',
      grade: '4',
      band: 'middle',
      skillCode: 'DIV.LONG',
      startedAt: new Date('2026-11-12T19:58:00.000Z'),
      attempts: 0,
      consecutiveWrong: 0,
      consecutiveSilences: 0,
      consecutiveStuck: 0,
      correctStreak: 0,
      repeatedMisconception: null,
      lastApproach: null,
      unmetPrerequisite: 'DIV.FACT.10',
      nextTopic: null,
      ...session,
    },
    modelContext: null,
    recentKinds: [],
  };
}

const policy = (correct: () => boolean) =>
  createTeachingPolicy<null>({
    gradeAnswer: () => ({ correct: correct(), misconception: null }),
    sessionLimitMs: () => 20 * 60_000,
    now: () => new Date(AT),
  });

describe('a procedure item (P3-07)', () => {
  it('walks 157 ÷ 4 a step at a time, and shows the answer only after the last step', () => {
    const wrong = policy(() => false);
    const steps = 4;
    for (let stuck = 0; stuck < steps; stuck += 1) {
      const decision = wrong(
        context({
          procedureSteps: steps,
          consecutiveStuck: stuck,
          consecutiveWrong: stuck,
          wrongOnSkill: stuck,
        }),
        ANSWER,
      );
      expect(decision.defaultPlan).toMatchObject({
        kind: 'HINT',
        approach: 'point-to-step',
        evidence: { procedureStep: stuck + 1, procedureSteps: steps },
      });
      expect(decision.allowedMoves).not.toContain('REVEAL');
    }
    const after = wrong(
      context({
        procedureSteps: steps,
        consecutiveStuck: steps,
        consecutiveWrong: steps,
        wrongOnSkill: steps,
      }),
      ANSWER,
    );
    expect(after.allowedMoves).toContain('REVEAL');
  });

  it('honours a skip mid-way with a fresh question, not the answer', () => {
    const decision = policy(() => false)(
      context({ procedureSteps: 4, consecutiveStuck: 1 }),
      event({ kind: 'SKIP', respondsTo: 'ask-1', reason: 'too_hard' }),
    );
    expect(decision.defaultPlan).toMatchObject({ kind: 'ASK', approach: 'easier-item' });
    expect(decision.allowedMoves).not.toContain('REVEAL');
  });

  it('leaves an item with no steps exactly as before', () => {
    const decision = policy(() => false)(
      context({ consecutiveStuck: 2, consecutiveWrong: 2 }),
      ANSWER,
    );
    expect(decision.defaultPlan.kind).not.toBe('HINT');
  });

  it('never offers REVEAL before every step has had a turn, over 1,000 random streams', () => {
    let checked = 0;
    for (let seed = 1; seed <= 1_000; seed += 1) {
      let value = seed;
      const next = (): number => {
        value = (value * 1_103_515_245 + 12_345) % 2_147_483_648;
        return value / 2_147_483_648;
      };
      const steps = 2 + Math.floor(next() * 5);
      let stuck = 0;
      for (let turn = 0; turn < 10 && stuck < steps; turn += 1) {
        const roll = next();
        const incoming =
          roll < 0.6
            ? ANSWER
            : roll < 0.8
              ? event({ kind: 'CONFUSED', aboutMoveId: 'ask-1' })
              : event({
                  kind: 'SKIP',
                  respondsTo: 'ask-1',
                  reason: SKIP_REASONS[Math.floor(next() * SKIP_REASONS.length)],
                });
        const decision = policy(() => next() < 0.2)(
          context({
            procedureSteps: steps,
            consecutiveStuck: stuck,
            consecutiveWrong: stuck,
            wrongOnSkill: stuck,
          }),
          incoming,
        );
        const label = `seed ${String(seed)}, turn ${String(turn)}`;
        expect(decision.defaultPlan.kind, label).not.toBe('REVEAL');
        expect(decision.allowedMoves, label).not.toContain('REVEAL');
        checked += 1;
        // A right answer, a skip or a new topic ends the item; anything else is one more step.
        if (decision.graded?.correct === true || incoming.kind === 'SKIP') break;
        stuck += 1;
      }
    }
    expect(checked).toBeGreaterThan(2_000);
  });
});
