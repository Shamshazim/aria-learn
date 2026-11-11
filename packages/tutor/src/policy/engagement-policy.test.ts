import { describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION, tutorInputEventSchema, type TutorInputEvent } from '@aria/shared';

import { allCheckInCopy, readCheckInReply } from '../engagement/check-in';
import { EMPTY_HISTORY, type EngagementContext } from '../engagement/types';

import { createTeachingPolicy } from './teaching-policy';

import type { LoadedTurnContext, SessionSnapshot } from '../types';

const NOW = new Date('2026-11-10T20:10:00.000Z');
const STATE_WORDS = /\b(?:tired|frustrat\w*|bored|boring|sleepy|annoy\w*|upset)\b/iu;

function event(fields: Readonly<Record<string, unknown>>): TutorInputEvent {
  return tutorInputEventSchema.parse({
    id: 'event-1',
    at: NOW.toISOString(),
    protocolVersion: PROTOCOL_VERSION,
    ...fields,
  });
}

function context(
  engagement: Partial<EngagementContext> = {},
  session: Partial<SessionSnapshot> = {},
): LoadedTurnContext<null> {
  return {
    session: {
      id: 'session-1',
      studentId: 'student-1',
      subject: 'arithmetic',
      grade: 'K',
      band: 'early',
      skillCode: 'ADD.FACT.10',
      startedAt: new Date('2026-11-10T20:00:00.000Z'),
      attempts: 0,
      consecutiveWrong: 0,
      consecutiveSilences: 0,
      consecutiveStuck: 0,
      correctStreak: 0,
      repeatedMisconception: null,
      lastApproach: null,
      unmetPrerequisite: null,
      nextTopic: 'ADD.FACT.20',
      engagement: {
        signals: [],
        history: EMPTY_HISTORY,
        previous: null,
        openCheckIn: null,
        ...engagement,
      },
      ...session,
    },
    modelContext: null,
    recentKinds: [],
  };
}

const policy = createTeachingPolicy<null>({
  gradeAnswer: () => ({ correct: false, misconception: null }),
  sessionLimitMs: () => 20 * 60_000,
  now: () => NOW,
});

const IDLE = event({ kind: 'ENGAGEMENT_SIGNAL', signal: 'idle', hiddenMs: 45_000 });
const TIRED = event({ kind: 'SPEECH_FINAL', text: "I'm so tired", confidence: 0.95 });

describe('reviewed check-in copy', () => {
  it('asks, and never tells a child what they feel', () => {
    for (const copy of allCheckInCopy()) {
      const sentences = copy.text.match(/[^.!?]+[.!?]/gu) ?? [];
      expect(sentences.join('')).toBe(copy.text);
      for (const sentence of sentences) {
        if (STATE_WORDS.test(sentence)) expect(sentence.trim().endsWith('?')).toBe(true);
      }
      expect(copy.text.trim().endsWith('?')).toBe(true);
      expect(copy.options).toHaveLength(2);
    }
  });

  it('honours "stop" and a denial from any check-in, and nothing it did not offer', () => {
    expect(readCheckInReply('disengaged', { text: 'I want to stop' })).toBe('stop');
    expect(readCheckInReply('tired', { text: "I'm not tired" })).toBe('keep');
    expect(readCheckInReply('tired', { choiceId: 'easy' })).toBe('easy');
    expect(readCheckInReply('tired', { text: 'something different' })).toBeNull();
  });
});

describe('the policy with an engagement state', () => {
  it('checks in on a low-confidence state with reviewed wording, and skips the planner', () => {
    const decision = policy(context(), IDLE);
    expect(decision.defaultPlan).toMatchObject({
      kind: 'CHECK_IN',
      approach: 'engagement-disengaged',
    });
    expect(decision.defaultPlan.evidence).toMatchObject({
      engagementCheckIn: 'disengaged',
      engagementDecision: 'check_in',
      engagementConfidence: 0.4,
      engagementSignals: 'idle',
    });
    expect(decision.decisive).toBe(true);
    expect(decision.allowedMoves).toEqual(['CHECK_IN']);
  });

  it('says nothing about a signal too weak to ask about, but still records it', () => {
    const decision = policy(
      context(),
      event({ kind: 'ENGAGEMENT_SIGNAL', signal: 'tab_hidden', hiddenMs: 8_000 }),
    );
    expect(decision.reasons).toEqual(['engagement_noted']);
    expect(decision.defaultPlan.evidence).toMatchObject({ engagementSignals: 'tab_hidden' });
  });

  it('does not grade "I\'m tired" and acts on it once, then escalates, then stops', () => {
    const first = policy(context(), TIRED);
    expect(first.graded).toBeNull();
    expect(first.defaultPlan).toMatchObject({ kind: 'BREAK', approach: 'attention' });
    const frustrated = event({
      kind: 'SPEECH_FINAL',
      text: 'this is so annoying',
      confidence: 0.95,
    });
    expect(policy(context(), frustrated).defaultPlan).toMatchObject({
      kind: 'ASK',
      approach: 'easier-item',
    });
    const again = policy(
      context({ history: { ...EMPTY_HISTORY, adapted: ['frustrated'] } }),
      frustrated,
    );
    expect(again.defaultPlan.kind).toBe('BREAK');
    expect(again.defaultPlan.evidence).toMatchObject({ engagementEscalated: true });
  });

  it('changes subject for a child who says it is boring', () => {
    const bored = event({ kind: 'SPEECH_FINAL', text: 'this is boring', confidence: 0.95 });
    expect(policy(context(), bored).defaultPlan).toMatchObject({
      kind: 'SWITCH',
      skillCode: 'ADD.FACT.20',
    });
  });

  it('never lets an inference outrank a stop, the time limit, or praise for a right answer', () => {
    const stop = event({ kind: 'SPEECH_FINAL', text: 'I want to stop', confidence: 0.95 });
    const classified = createTeachingPolicy<null>({
      gradeAnswer: () => ({ correct: true, misconception: null }),
      classifyIntent: (input) =>
        input.kind === 'SPEECH_FINAL' && input.text.includes('stop') ? 'STOP_REQUEST' : null,
      sessionLimitMs: () => 20 * 60_000,
      now: () => NOW,
    });
    const tiredBefore = context({
      signals: [{ name: 'said_tired', at: new Date(NOW.getTime() - 30_000) }],
    });
    expect(classified(tiredBefore, stop).reasons).toContain('stop_request');
    const right = event({ kind: 'ANSWER', respondsTo: 'ask-1', text: '7' });
    expect(classified(tiredBefore, right).defaultPlan.kind).toBe('PRAISE');
  });
});

describe('answering a check-in', () => {
  const open = { openCheckIn: { state: 'tired', moveId: 'check-1' } } as const;

  it('stops on "stop", and is never graded', () => {
    const decision = policy(
      context(open),
      event({ kind: 'ANSWER', respondsTo: 'check-1', choiceId: 'stop' }),
    );
    expect(decision).toMatchObject({
      terminal: true,
      graded: null,
      defaultPlan: { kind: 'BREAK' },
    });
  });

  it('clears the state on "I\'m not tired" and logs a false positive', () => {
    const decision = policy(
      context(open),
      event({ kind: 'SPEECH_FINAL', text: "no I'm not tired", confidence: 0.9 }),
    );
    expect(decision.defaultPlan).toMatchObject({ kind: 'ASK', approach: 'same-item' });
    expect(decision.defaultPlan.evidence).toMatchObject({
      engagementDenied: 'tired',
      engagementFalsePositive: true,
      engagementConfidence: 0,
    });
  });

  it('gives an easier one on "easy"', () => {
    const decision = policy(
      context(open),
      event({ kind: 'ANSWER', respondsTo: 'check-1', choiceId: 'easy' }),
    );
    expect(decision.defaultPlan).toMatchObject({ kind: 'ASK', approach: 'easier-item' });
  });

  it('treats an answer to the question underneath as an answer', () => {
    const decision = policy(
      context(open),
      event({ kind: 'ANSWER', respondsTo: 'ask-1', text: '7' }),
    );
    expect(decision.graded).not.toBeNull();
  });
});
