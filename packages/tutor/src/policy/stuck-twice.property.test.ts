import { describe, expect, it } from 'vitest';

import {
  PROTOCOL_VERSION,
  SKIP_REASONS,
  tutorInputEventSchema,
  type MoveKind,
  type TutorInputEvent,
} from '@aria/shared';

import { createTeachingPolicy } from './teaching-policy';

import type { LoadedTurnContext, SessionSnapshot } from '../types';

/**
 * P3-04 acceptance: "a fixture stream of two wrong ANSWERs can never yield ASK on the same form
 * as the third move, over 1,000 randomised event streams". The planner here picks at random
 * from whatever it is allowed, so the property holds for any planner, not only the default.
 */
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

function context(session: Partial<SessionSnapshot>): LoadedTurnContext<null> {
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

function policyGrading(grade: Parameters<typeof createTeachingPolicy<null>>[0]['gradeAnswer']) {
  return createTeachingPolicy<null>({
    gradeAnswer: grade,
    sessionLimitMs: () => 20 * 60_000,
    now: () => new Date(AT),
  });
}

/** A small deterministic generator, so a failure names a seed that reproduces it. */
function generator(seed: number) {
  let value = seed;
  const next = (): number => {
    value = (value * 1_103_515_245 + 12_345) % 2_147_483_648;
    return value / 2_147_483_648;
  };
  const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T;
  return { next, pick };
}

type Simulated = Readonly<{
  wrongOnSkill: number;
  consecutiveWrong: number;
  consecutiveStuck: number;
  consecutiveSilences: number;
  correctStreak: number;
  previousMisconception: string | null;
  lastApproach: string | null;
}>;

const MISCONCEPTIONS = [null, 'counts-from-one', 'adds-digits'] as const;

function randomEvent(random: ReturnType<typeof generator>): TutorInputEvent {
  const kind = random.pick([
    'ANSWER',
    'ANSWER',
    'ANSWER',
    'SPEECH_FINAL',
    'CONFUSED',
    'SKIP',
    'SILENCE',
    'RESUME',
    'QUESTION',
  ] as const);
  if (kind === 'ANSWER') return ANSWER;
  if (kind === 'SPEECH_FINAL') return event({ kind, text: 'nine', confidence: 0.95 });
  if (kind === 'CONFUSED') return event({ kind, aboutMoveId: 'ask-1' });
  if (kind === 'SKIP')
    return event({ kind, respondsTo: 'ask-1', reason: random.pick(SKIP_REASONS) });
  if (kind === 'SILENCE') return event({ kind, waitedMs: 12_000 });
  if (kind === 'QUESTION') return event({ kind, text: 'why is it nine?' });
  return event({ kind });
}

type Graded = Readonly<{ correct: boolean; misconception: string | null }>;

type Turn = Readonly<{
  graded: Graded | null;
  chosen: MoveKind;
  incoming: TutorInputEvent;
  approach: string;
  terminal: boolean;
}>;

const START: Simulated = {
  wrongOnSkill: 0,
  consecutiveWrong: 0,
  consecutiveStuck: 0,
  consecutiveSilences: 0,
  correctStreak: 0,
  previousMisconception: null,
  lastApproach: null,
};

/** One turn through the real policy, with a planner that picks at random from its set. */
function playTurn(
  random: ReturnType<typeof generator>,
  state: Simulated,
  unmet: string | null,
): Turn {
  let graded: Graded | null = null;
  const policy = policyGrading(() => {
    graded = { correct: random.next() < 0.3, misconception: random.pick(MISCONCEPTIONS) };
    return graded;
  });
  const incoming = randomEvent(random);
  const decision = policy(context({ ...state, unmetPrerequisite: unmet }), incoming);
  // The planner may pick anything it is offered; the policy's own plan is in that set.
  const chosen =
    random.next() < 0.5 ? decision.defaultPlan.kind : random.pick(decision.allowedMoves);
  return {
    graded,
    chosen,
    incoming,
    approach: decision.defaultPlan.approach,
    terminal: decision.terminal,
  };
}

/** Whether this turn is one the invariant is about, and if so that it held. */
function checkTurn(state: Simulated, turn: Turn, label: string): boolean {
  const wrongAfter =
    turn.graded === null ? state.wrongOnSkill : turn.graded.correct ? 0 : state.wrongOnSkill + 1;
  if (wrongAfter < 2 || turn.terminal) return false;
  expect(turn.chosen, label).not.toBe('ASK');
  if (state.consecutiveStuck > 0) expect(turn.chosen, label).not.toBe('HINT');
  return true;
}

describe('the stuck-twice invariant', () => {
  it('never lets ASK follow two wrong answers on a skill, over 1,000 random streams', () => {
    let checked = 0;
    for (let seed = 1; seed <= 1_000; seed += 1) {
      const random = generator(seed);
      const unmet = random.next() < 0.5 ? 'NUM.CNT.20' : null;
      let state = START;
      for (let index = 0; index < 12; index += 1) {
        const turn = playTurn(random, state, unmet);
        if (checkTurn(state, turn, `seed ${String(seed)}, turn ${String(index)}`)) checked += 1;
        if (turn.terminal) break;
        state = advance(state, turn);
      }
    }
    // The property is only worth something if the streams reach the state it is about.
    expect(checked).toBeGreaterThan(1_000);
  });
});

/** What the session log would say after this turn, as the API's counters derive it. */
function advance(state: Simulated, turn: Turn): Simulated {
  const silent = turn.incoming.kind === 'SILENCE';
  const next: Simulated = {
    ...answered(state, turn),
    lastApproach: turn.approach,
    consecutiveSilences: silent ? state.consecutiveSilences + 1 : 0,
  };
  // A new skill starts every count over; a fresh question starts the item's.
  if (turn.chosen === 'SWITCH') {
    return {
      ...next,
      wrongOnSkill: 0,
      consecutiveStuck: 0,
      correctStreak: 0,
      previousMisconception: null,
    };
  }
  if (turn.chosen === 'REVEAL' || turn.chosen === 'ASK') {
    return { ...next, consecutiveStuck: 0, previousMisconception: null };
  }
  return next;
}

function answered(state: Simulated, turn: Turn): Simulated {
  const { graded } = turn;
  if (graded === null) {
    const stuck = turn.incoming.kind === 'CONFUSED' || turn.incoming.kind === 'SKIP';
    return { ...state, consecutiveStuck: state.consecutiveStuck + (stuck ? 1 : 0) };
  }
  if (graded.correct) {
    return {
      ...state,
      consecutiveWrong: 0,
      wrongOnSkill: 0,
      consecutiveStuck: 0,
      correctStreak: state.correctStreak + 1,
    };
  }
  return {
    ...state,
    consecutiveWrong: state.consecutiveWrong + 1,
    wrongOnSkill: state.wrongOnSkill + 1,
    consecutiveStuck: state.consecutiveStuck + 1,
    correctStreak: 0,
    previousMisconception: graded.misconception,
  };
}
