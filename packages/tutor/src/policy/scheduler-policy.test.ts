import { describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION, tutorInputEventSchema, type TutorInputEvent } from '@aria/shared';

import { STUCK_TWICE_REASON } from '../scheduler/invariant';

import { createTeachingPolicy, type AnswerGrader } from './teaching-policy';

import type { LoadedTurnContext, SessionSnapshot } from '../types';

const AT = '2026-11-10T20:00:00.000Z';

function event(fields: Readonly<Record<string, unknown>>): TutorInputEvent {
  return tutorInputEventSchema.parse({
    id: 'event-1',
    at: AT,
    protocolVersion: PROTOCOL_VERSION,
    ...fields,
  });
}

const ANSWER = event({ kind: 'ANSWER', respondsTo: 'ask-1', text: 'nine' });

function context(session: Partial<SessionSnapshot> = {}): LoadedTurnContext<null> {
  return {
    session: {
      id: 'session-1',
      studentId: 'student-1',
      subject: 'arithmetic',
      grade: '1',
      band: 'early',
      skillCode: 'ADD.FACT.10',
      startedAt: new Date('2026-11-10T19:58:00.000Z'),
      attempts: 0,
      consecutiveWrong: 0,
      consecutiveSilences: 0,
      consecutiveStuck: 0,
      correctStreak: 0,
      repeatedMisconception: null,
      lastApproach: null,
      unmetPrerequisite: null,
      nextTopic: null,
      ...session,
    },
    modelContext: null,
    recentKinds: [],
  };
}

function policyGrading(grade: AnswerGrader) {
  return createTeachingPolicy<null>({
    gradeAnswer: grade,
    sessionLimitMs: () => 20 * 60_000,
    now: () => new Date(AT),
  });
}

const wrongWith = (misconception: string | null) =>
  policyGrading(() => ({ correct: false, misconception }));

describe('P3-04 scheduler rules in the teaching policy', () => {
  it('goes back to the weakest prerequisite after two wrong answers with different wrong ideas', () => {
    const second = context({
      consecutiveWrong: 1,
      wrongOnSkill: 1,
      consecutiveStuck: 1,
      previousMisconception: 'counts-from-one',
      unmetPrerequisite: 'NUM.CNT.20',
    });
    const decision = wrongWith('adds-digits')(second, ANSWER);
    expect(decision.defaultPlan).toMatchObject({
      kind: 'SWITCH',
      approach: 'prerequisite-step',
      skillCode: 'NUM.CNT.20',
    });
    expect(decision.reasons).toEqual(['different_misconceptions', 'step_back']);
  });

  it('changes strand when two different wrong ideas have nothing weak underneath', () => {
    const second = context({
      consecutiveWrong: 1,
      consecutiveStuck: 1,
      previousMisconception: 'counts-from-one',
      alternateStrandSkill: 'NUM.CNT.SKIP5',
    });
    expect(wrongWith('adds-digits')(second, ANSWER).defaultPlan).toMatchObject({
      kind: 'SWITCH',
      approach: 'other-strand',
      skillCode: 'NUM.CNT.SKIP5',
    });
    const nowhere = context({ ...second.session, alternateStrandSkill: null });
    expect(wrongWith('adds-digits')(nowhere, ANSWER).defaultPlan.kind).toBe('RETEACH');
  });

  it('reteaches with the fix when the same wrong idea is seen a second time', () => {
    const second = context({
      consecutiveWrong: 1,
      consecutiveStuck: 1,
      previousMisconception: 'counts-from-one',
      unmetPrerequisite: 'NUM.CNT.20',
    });
    const decision = wrongWith('counts-from-one')(
      { ...second, session: { ...second.session, repeatedMisconception: 'counts-from-one' } },
      ANSWER,
    );
    expect(decision.defaultPlan).toMatchObject({ kind: 'RETEACH', approach: 'misconception-fix' });
    expect(decision.decisive).toBe(true);
  });

  it('reads an earlier session’s sighting from the record, and not once it is cleared', () => {
    const history = (cleared: boolean) =>
      context({ misconceptionHistory: { 'counts-from-one': { seenCount: 1, cleared } } });
    expect(wrongWith('counts-from-one')(history(false), ANSWER).defaultPlan.approach).toBe(
      'misconception-fix',
    );
    // Cleared, then seen again: the sighting un-clears it, and the fix comes straight back.
    expect(wrongWith('counts-from-one')(history(true), ANSWER).defaultPlan.approach).toBe(
      'misconception-fix',
    );
    expect(wrongWith('counts-from-one')(context(), ANSWER).defaultPlan.kind).toBe('HINT');
  });

  it('rewrites a re-ask after two wrong answers and logs why', () => {
    const resumed = context({ wrongOnSkill: 2, consecutiveWrong: 2, consecutiveStuck: 2 });
    const decision = wrongWith(null)(resumed, event({ kind: 'RESUME' }));
    expect(decision.defaultPlan.kind).toBe('RETEACH');
    expect(decision.defaultPlan.evidence).toMatchObject({
      invariant: 'policy.invariant.stuck-twice',
      rewrote: 'ASK',
    });
    expect(decision.reasons).toContain(STUCK_TWICE_REASON);
    expect(decision.allowedMoves).not.toContain('ASK');
  });
});
